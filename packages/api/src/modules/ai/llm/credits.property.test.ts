import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeActualCreditCost, computeChatCreditCost, estimateTokens } from "./credits";

describe("llm credits pricing", () => {
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

  it("actual cost never exceeds the capped pre-charge", async () => {
    await fc.assert(
      fc.property(
        fc.integer({ max: 100_000, min: 0 }), // input tokens in text
        fc.integer({ max: 50, min: 1 }), // creditPrice
        fc
          .integer({ max: 8_000, min: 1 })
          .chain((cap) => fc.tuple(fc.constant(cap), fc.integer({ max: cap, min: 0 }))),
        (inputTokens, price, [cap, outputTokens]) => {
          const pre = computeChatCreditCost({
            creditPrice: price,
            maxOutputTokens: cap,
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

  it("estimateTokens counts each CJK char as one token and every four other chars as one", async () => {
    await fc.assert(
      fc.property(
        fc.integer({ max: 512, min: 0 }),
        fc.integer({ max: 512, min: 0 }),
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
