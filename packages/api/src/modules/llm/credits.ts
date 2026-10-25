/**
 * LLM chat credit metering (Task 5) — estimate / preload / settle.
 *
 * 聊天按量计费三步走：
 *   1. **估算**（{@link estimateTokens}）：纯函数，非 CJK 字符每 4 个 ≈ 1 token，
 *      CJK 字符逐字计 1 token（无需分词器、跨供应商一致的保守口径）。
 *   2. **预扣**（{@link preloadChatCredits}）：流式开始前按
 *      「输入估算 + maxOutputTokens 封顶」预扣积分，余额不足即抛错（不开始流）。
 *   3. **冲账**（{@link settleChatCredits}）：流结束后按实际 totalTokens 结算——
 *      实际 < 预扣 → 整条撤销预扣后按实际补扣（两步非事务，见函数注释）；
 *      实际 >= 预扣 → 保留预扣（封顶保护，多出的由平台承担）。
 *
 * 积分原语（`consume`/`revoke`，FIFO 批次）复用 `@openstarter/billing-web`；
 * 目录定价复用 `../ai-catalog/service` 的 `findModelByProviderAndId`。
 * `InsufficientCreditsError` 从 `../ai/tasks/service` re-export，全包共用同一错误类型。
 */

import { consume, revoke } from "@openstarter/billing-web";
import { credit } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

import { findModelByProviderAndId } from "../ai-catalog/service";
import { InsufficientCreditsError } from "../ai/tasks/service";

export { InsufficientCreditsError };

/** 默认输出封顶：目录未配置 `maxOutputTokens` 时按 4096 预扣。 */
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

/** 每 1000 token 计一次 `creditPrice`。 */
const TOKENS_PER_CREDIT_UNIT = 1000;

/** 非 CJK 字符的 token 折算：每 4 个字符 ≈ 1 token。 */
const CHARS_PER_TOKEN = 4;

/** CJK 字符判断：CJK 基本区（U+4E00–U+9FFF）与扩展 A 区（U+3400–U+4DBF）。 */
const CJK_CHAR = /[一-鿿㐀-䶿]/;

/** LLM 聊天扣费场景标签（写入积分流水 `transactionScene`）。 */
const LLM_CHAT_SCENE = "llm_chat";

/** LLM 聊天扣费描述文案（写入积分流水 `description`）。 */
const LLM_CHAT_DESCRIPTION = "LLM chat";

// ─── 估算（Estimate，纯函数） ────────────────────────────────────────────────

/**
 * 估算文本的 token 数（纯函数，无 I/O）。
 *
 * 非 CJK 字符数 ÷ 4 向上取整 + CJK 字符数（逐字符判断）。这是与供应商分词器无关的
 * 保守估算：对纯 ASCII 文本每 4 字符 ≈ 1 token；CJK 一律按 1 token/字计。
 */
export function estimateTokens(text: string): number {
  let cjkCount = 0;
  let otherCount = 0;
  for (const char of text) {
    if (CJK_CHAR.test(char)) {
      cjkCount += 1;
    } else {
      otherCount += 1;
    }
  }
  return Math.ceil(otherCount / CHARS_PER_TOKEN) + cjkCount;
}

/** 计费入参：模型侧文本（估算输入）+ 输出封顶 + 目录单价。 */
interface ChatCreditCostParams {
  creditPrice: number;
  maxOutputTokens: number;
  modelText: string;
}

/**
 * 预扣费用：`ceil((estimateTokens(modelText) + maxOutputTokens) / 1000) * creditPrice`。
 *
 * 输出按 `maxOutputTokens` 封顶计价（宁可多预扣），流结束后由
 * {@link settleChatCredits} 按实际用量冲账。
 */
export function computeChatCreditCost(args: ChatCreditCostParams): number {
  const inputTokens = estimateTokens(args.modelText);
  return (
    Math.ceil((inputTokens + args.maxOutputTokens) / TOKENS_PER_CREDIT_UNIT) * args.creditPrice
  );
}

/** 结算入参：实际用量 + 目录单价。 */
interface ActualCreditCostParams {
  creditPrice: number;
  totalTokens: number;
}

/**
 * 实际费用：`ceil(totalTokens / 1000) * creditPrice`。
 */
export function computeActualCreditCost(args: ActualCreditCostParams): number {
  return Math.ceil(args.totalTokens / TOKENS_PER_CREDIT_UNIT) * args.creditPrice;
}

// ─── 预扣（Preload） ─────────────────────────────────────────────────────────

/** 预扣入参。`historyChars` 为已统计的历史文本字符数（见函数注释）。 */
export interface PreloadChatCreditsParams {
  chatId: string;
  historyChars: number;
  model: string;
  provider: string;
  userId: string;
}

/** 预扣结果：`consumedCreditId === null` 表示免费（无目录条目或 `creditPrice === 0`）。 */
export interface PreloadChatCreditsResult {
  consumedCreditId: string | null;
  estimatedCost: number;
  maxOutputTokens: number | null;
}

/**
 * 流式开始前预扣聊天积分。
 *
 * 1. 查目录（`findModelByProviderAndId`）：无条目或 `creditPrice === 0` → 免费，
 *    返回 `{ consumedCreditId: null, estimatedCost: 0, maxOutputTokens: null }`。
 * 2. 否则 `estimatedCost = computeChatCreditCost({ modelText: "x".repeat(historyChars), ... })`：
 *    调用方已统计历史字符数，此处以纯 ASCII 文本还原（每 4 字符 ≈ 1 token，与逐字符
 *    估算等价），避免把整段历史再次传入。
 * 3. `consume` 预扣；余额不足（`success: false`）→ 抛
 *    {@link InsufficientCreditsError}（路由层转 402）。
 */
export async function preloadChatCredits(
  args: PreloadChatCreditsParams,
): Promise<PreloadChatCreditsResult> {
  const catalogModel = await findModelByProviderAndId(args.provider, args.model);

  if (!catalogModel || catalogModel.creditPrice === 0) {
    return { consumedCreditId: null, estimatedCost: 0, maxOutputTokens: null };
  }

  const maxOutputTokens = catalogModel.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const estimatedCost = computeChatCreditCost({
    creditPrice: catalogModel.creditPrice,
    maxOutputTokens,
    modelText: "x".repeat(args.historyChars),
  });

  const result = await consume({
    credits: estimatedCost,
    description: LLM_CHAT_DESCRIPTION,
    metadata: JSON.stringify({ chatId: args.chatId }),
    scene: LLM_CHAT_SCENE,
    userId: args.userId,
  });

  if (!(result.success && result.consumedCredit)) {
    throw new InsufficientCreditsError();
  }

  return { consumedCreditId: result.consumedCredit.id, estimatedCost, maxOutputTokens };
}

// ─── 冲账（Settle） ──────────────────────────────────────────────────────────

/** 结算入参。`consumedCreditId === null`（免费）直接返回；`totalTokens` 缺失时保留预扣。 */
export interface SettleChatCreditsParams {
  consumedCreditId: string | null;
  estimatedCost: number;
  model: string;
  provider: string;
  totalTokens?: number;
}

/**
 * 流式结束后按实际用量冲账。
 *
 * 入参保持 plan 规定的签名（不含 userId/creditPrice）：结算单价经
 * `findModelByProviderAndId` 按目录重查；归属（userId/userEmail/scene/metadata）
 * 在撤销前从原消费流水回读。
 *
 * - 免费会话（`consumedCreditId === null`）直接返回。
 * - `totalTokens` 缺失（上游未回报用量）→ warn 日志并保留预扣（按封顶计价，不退款）。
 * - 消费流水缺失、或目录条目缺失/价格归零 → 结算价或归属未知，warn 并保留预扣
 *   （不基于未知归属/单价退款）。
 * - `estimated <= actual` → 保留预扣并 warn：输出封顶保护下的极端情况（用量越过封顶），
 *   差额由平台承担，不再向用户追扣。
 * - `estimated > actual` → **整条**撤销预扣（`revoke` 是整条撤销，无法只冲差额），
 *   再按实际用量 `consume` 补扣。两步**非事务**：冲账窗口极短（毫秒级），窗口期内
 *   用户短暂多持差额，属可接受的单边让利；换取不引入跨模块事务耦合。
 */
export async function settleChatCredits(args: SettleChatCreditsParams): Promise<void> {
  if (args.consumedCreditId === null) {
    return;
  }

  if (args.totalTokens === undefined) {
    logger.warn(
      "[llm-credits] missing totalTokens after chat completion; keeping preload",
      args.provider,
      args.model,
    );
    return;
  }

  const actualCost = await computeSettleActualCost(args);

  if (actualCost === null) {
    return;
  }

  if (args.estimatedCost <= actualCost) {
    logger.warn(
      "[llm-credits] actual cost exceeds preload (capped output); keeping preload",
      args.provider,
      args.model,
    );
    return;
  }

  // 整条撤销 + 按实际补扣（两步非事务，见函数级注释）。归属（user/scene/metadata）
  // 从原消费流水回读，避免 settle 入参再携带 userId。
  const record = await loadConsumeRecord(args.consumedCreditId);
  if (!record) {
    // 理论不可达（computeSettleActualCost 已核验），防御性兜底：保留预扣。
    return;
  }

  await revoke({ consumeCreditId: args.consumedCreditId });
  const result = await consume({
    credits: actualCost,
    description: record.description || LLM_CHAT_DESCRIPTION,
    metadata: record.metadata || "",
    scene: record.transactionScene || LLM_CHAT_SCENE,
    userEmail: record.userEmail || "",
    userId: record.userId,
  });
  if (!(result.success && result.consumedCredit)) {
    throw new InsufficientCreditsError();
  }
}

/**
 * Read a `consume` record by id (any status, for attribution recovery).
 */
function loadConsumeRecord(
  consumeCreditId: string,
): Promise<typeof credit.$inferSelect | undefined> {
  return db()
    .select()
    .from(credit)
    .where(eq(credit.id, consumeCreditId))
    .limit(1)
    .then((rows) => rows[0]);
}

/**
 * Resolve the settled cost from the catalog price, or `null` to keep the preload.
 *
 * 结算单价与归属逐层核验，任一缺失都不动预扣（保留原预扣额，多退少不补的兜底是
 * 用户已按封顶付费，不产生少收）：
 *   1. 按 `consumedCreditId` 回读消费流水（缺 → 无归属可补扣，保留预扣）；
 *   2. 按目录重查 `creditPrice`（条目缺失或价格归零 → 结算价未知，保留预扣）；
 *   3. 按 `ceil(totalTokens / 1000) * creditPrice` 计算实际费用。
 */
async function computeSettleActualCost(args: SettleChatCreditsParams): Promise<number | null> {
  const consumedCreditId = args.consumedCreditId as string;
  const record = await loadConsumeRecord(consumedCreditId);
  if (!record) {
    logger.warn(
      "[llm-credits] consume record not found at settle; keeping preload",
      consumedCreditId,
    );
    return null;
  }

  const catalogModel = await findModelByProviderAndId(args.provider, args.model);
  if (!catalogModel || catalogModel.creditPrice === 0) {
    logger.warn(
      "[llm-credits] catalog price unavailable at settle; keeping preload",
      args.provider,
      args.model,
    );
    return null;
  }

  return computeActualCreditCost({
    creditPrice: catalogModel.creditPrice,
    totalTokens: args.totalTokens as number,
  });
}
