import { consume, revoke } from "@openstarter/billing-web";
import { credit } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

import { findModelByProviderAndId } from "../catalog/service";
import { InsufficientCreditsError } from "../tasks/service";

export { InsufficientCreditsError };

const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

const TOKENS_PER_CREDIT_UNIT = 1000;

const CHARS_PER_TOKEN = 4;

const CJK_CHAR = /[一-鿿㐀-䶿]/;

const LLM_CHAT_SCENE = "llm_chat";

const LLM_CHAT_DESCRIPTION = "LLM chat";

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

interface ChatCreditCostParams {
  creditPrice: number;
  maxOutputTokens: number;
  modelText: string;
}

export function computeChatCreditCost(args: ChatCreditCostParams): number {
  const inputTokens = estimateTokens(args.modelText);
  return (
    Math.ceil((inputTokens + args.maxOutputTokens) / TOKENS_PER_CREDIT_UNIT) * args.creditPrice
  );
}

interface ActualCreditCostParams {
  creditPrice: number;
  totalTokens: number;
}

export function computeActualCreditCost(args: ActualCreditCostParams): number {
  return Math.ceil(args.totalTokens / TOKENS_PER_CREDIT_UNIT) * args.creditPrice;
}

export interface PreloadChatCreditsParams {
  chatId: string;
  historyChars: number;
  model: string;
  provider: string;
  userId: string;
}

export interface PreloadChatCreditsResult {
  consumedCreditId: string | null;
  estimatedCost: number;
  maxOutputTokens: number | null;
}

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

export interface SettleChatCreditsParams {
  consumedCreditId: string | null;
  estimatedCost: number;
  model: string;
  provider: string;
  totalTokens?: number;
}

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

  const record = await loadConsumeRecord(args.consumedCreditId);
  if (!record) {
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
