// Property tests for LLM chat credit metering (Task 5) — pure pricing functions.
//
// No database involved: `estimateTokens` / `computeChatCreditCost` /
// `computeActualCreditCost` are pure and must hold the monotonicity / upper-bound
// properties below for arbitrary inputs. The DB-backed service entrances
// (`preloadChatCredits` / `settleChatCredits`) are covered by `credits.test.ts`.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeActualCreditCost, computeChatCreditCost, estimateTokens } from "./credits";

describe("llm credits pricing", () => {
  /** Appending text can never decrease the token estimate. */
  it("estimateTokens is monotonically non-decreasing under append", async () => {
    await fc.assert(
      fc.property(
        fc.string({ maxLength: 200, minLength: 0 }),
        fc.string({ maxLength: 50, minLength: 0 }),
        (base, suffix) => {
          expect(estimateTokens(base + suffix)).toBeGreaterThanOrEqual(estimateTokens(base));
        },
      ),
    );
  });

  /**
   * The pre-charge caps output at maxOutputTokens, and providers enforce that cap
   * (total output = input + output with output <= maxOutputTokens), so the settled
   * cost can never exceed the pre-charge.
   *
   * 生成 output tokens 时与 pre-charge 使用**同一个** cap（chained，output <= cap）：
   * 若像规格初稿那样独立生成 totalTokens（可远超 cap），该性质不可满足——
   * fast-check 反例 [totalTokens=2, price=1, cap=1, inputTokens=49999]：
   * pre = ceil((49999+1)/1000)*1 = 50 < actual = ceil((49999+2)/1000)*1 = 51。
   * 供应商强制 maxOutputTokens 正是「封顶预扣」成立的前提（plan 修订已确认）。
   */
  it("actual cost never exceeds the capped pre-charge", async () => {
    await fc.assert(
      fc.property(
        fc.integer({ max: 100_000, min: 0 }), // input tokens in text
        fc.integer({ max: 50, min: 1 }), // creditPrice
        // [cap, outputTokens]: output generated under the SAME cap it is compared
        // against (chained, so outputTokens <= cap by construction).
        fc
          .integer({ max: 8_000, min: 1 })
          .chain((cap) => fc.tuple(fc.constant(cap), fc.integer({ max: cap, min: 0 }))),
        (inputTokens, price, [cap, outputTokens]) => {
          const pre = computeChatCreditCost({
            creditPrice: price,
            maxOutputTokens: cap,
            // inputTokens * 4 ASCII chars → exactly inputTokens estimated tokens.
            modelText: "a".repeat(inputTokens * 4),
          });
          const actual = computeActualCreditCost({
            creditPrice: price,
            totalTokens: inputTokens + outputTokens,
          });
          expect(actual).toBeLessThanOrEqual(pre);
        },
      ),
      { numRuns: 200 },
    );
  });

  /** Exact pricing formula: every 4 non-CJK chars ≈ 1 token, every CJK char = 1 token. */
  it("estimateTokens counts each CJK char as one token and every four other chars as one", async () => {
    await fc.assert(
      fc.property(
        fc.integer({ max: 512, min: 0 }),
        fc.integer({ max: 512, min: 0 }),
        // CJK 扩展 A 区（U+3400–U+4DBF）与基本区（U+4E00–U+9FFF），与实现的判断区间一致。
        fc.oneof(
          fc.integer({ max: 0x4dbf, min: 0x3400 }),
          fc.integer({ max: 0x9fff, min: 0x4e00 }),
        ),
        (asciiCount, cjkCount, cjkCode) => {
          const text = "x".repeat(asciiCount) + String.fromCharCode(cjkCode).repeat(cjkCount);
          expect(estimateTokens(text)).toBe(Math.ceil(asciiCount / 4) + cjkCount);
        },
      ),
    );
  });
});
