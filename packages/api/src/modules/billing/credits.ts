import { type Credit, credit, type NewCredit } from "../../db/schema";
import { type Database, d1Transaction, db } from "../../db/server";
import { getSnowId, getUuid } from "@openstarter/shared/id";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, ne, or, sql, sum } from "drizzle-orm";

import { readBooleanEnv, readEnv, readIntEnv } from "../../lib/env";

export const CreditStatus = {
  ACTIVE: "active",
  DELETED: "deleted",
  EXPIRED: "expired",
} as const;

export type CreditStatus = (typeof CreditStatus)[keyof typeof CreditStatus];

export const CreditTransactionType = {
  CONSUME: "consume",
  GRANT: "grant",
} as const;

export type CreditTransactionType =
  (typeof CreditTransactionType)[keyof typeof CreditTransactionType];

export const CreditTransactionScene = {
  GIFT: "gift",
  PAYMENT: "payment",
  RENEWAL: "renewal",
  REWARD: "reward",
  SUBSCRIPTION: "subscription",
} as const;

export type CreditTransactionScene =
  (typeof CreditTransactionScene)[keyof typeof CreditTransactionScene];

export function calculateCreditExpirationTime(params: {
  creditsValidDays?: number;
  currentPeriodEnd?: Date | null;
  now?: Date;
}): Date | null {
  const { creditsValidDays, currentPeriodEnd, now } = params;

  if (!creditsValidDays || creditsValidDays <= 0) {
    return null;
  }

  if (currentPeriodEnd) {
    return new Date(currentPeriodEnd.getTime());
  }

  const expiresAt = now ? new Date(now.getTime()) : new Date();
  expiresAt.setDate(expiresAt.getDate() + creditsValidDays);
  return expiresAt;
}

export interface GrantCreditsParams {
  credits: number;
  description?: string;
  expiresAt?: Date | null;
  orderNo?: string;
  scene?: string;
  subscriptionNo?: string;

  transactionNo?: string;

  tx?: BillingTransaction;
  userEmail?: string;
  userId: string;
}

export async function grant(params: GrantCreditsParams): Promise<NewCredit> {
  const newCredit: NewCredit = {
    credits: params.credits,
    description: params.description ?? "Grant credit",
    expiresAt: params.expiresAt ?? null,
    id: getUuid(),
    orderNo: params.orderNo ?? "",
    remainingCredits: params.credits,
    status: CreditStatus.ACTIVE,
    subscriptionNo: params.subscriptionNo ?? "",
    transactionNo: params.transactionNo ?? getSnowId(),
    transactionScene: params.scene ?? CreditTransactionScene.GIFT,
    transactionType: CreditTransactionType.GRANT,
    userEmail: params.userEmail ?? "",
    userId: params.userId,
  };

  if (params.tx) {
    await params.tx.insert(credit).values(newCredit);
  } else {
    await db().insert(credit).values(newCredit);
  }
  return newCredit;
}

function validGrantConditions(userId: string, now: Date) {
  return and(
    eq(credit.userId, userId),
    eq(credit.transactionType, CreditTransactionType.GRANT),
    eq(credit.status, CreditStatus.ACTIVE),
    gt(credit.remainingCredits, 0),
    or(isNull(credit.expiresAt), gt(credit.expiresAt, now)),
  );
}

function toBalance(total: string | null | undefined): number {
  return total ? Number.parseInt(total, 10) : 0;
}

export async function getBalance(userId: string): Promise<number> {
  const now = new Date();
  const [row] = await db()
    .select({ total: sum(credit.remainingCredits) })
    .from(credit)
    .where(validGrantConditions(userId, now));

  return toBalance(row?.total);
}

export interface ConsumedDetailItem {
  amount: number;
  creditId: string;
}

export type BillingTransaction = Database;

export interface ConsumeCreditsParams {
  credits: number;
  description?: string;
  metadata?: string;
  scene?: string;

  tx?: BillingTransaction;
  userEmail?: string;
  userId: string;
}

export interface ConsumeCreditsResult {
  consumedCredit?: NewCredit;
  success: boolean;
}

export class CreditContentionError extends Error {
  constructor() {
    super("Credit balance changed concurrently");
    this.name = "CreditContentionError";
  }
}

const MAX_CONSUME_ATTEMPTS = 3;

async function consumeWithinTransaction(
  tx: BillingTransaction,
  params: ConsumeCreditsParams,
): Promise<ConsumeCreditsResult> {
  const { userId, credits: amount } = params;
  const now = new Date();

  const batches = await tx
    .select()
    .from(credit)
    .where(validGrantConditions(userId, now))
    .orderBy(sql`case when ${credit.expiresAt} is null then 1 else 0 end`, asc(credit.expiresAt));

  const balance = batches.reduce((total, batch) => total + batch.remainingCredits, 0);
  if (balance < amount) {
    return { success: false };
  }

  let remaining = amount;
  const plan: { amount: number; creditId: string }[] = [];
  for (const batch of batches) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(remaining, batch.remainingCredits);
    plan.push({ amount: take, creditId: batch.id });
    remaining -= take;
  }

  const applied: ConsumedDetailItem[] = [];
  try {
    for (const item of plan) {
      const updated = await tx
        .update(credit)
        .set({ remainingCredits: sql`${credit.remainingCredits} - ${item.amount}` })
        .where(and(eq(credit.id, item.creditId), gte(credit.remainingCredits, item.amount)))
        .returning({ id: credit.id });
      if (updated.length === 0) {
        throw new CreditContentionError();
      }
      applied.push(item);
    }

    const consumedCredit: NewCredit = {
      consumedDetail: JSON.stringify(plan),
      credits: -amount,
      description: params.description ?? "",
      id: getUuid(),
      metadata: params.metadata ?? "",
      remainingCredits: 0,
      status: CreditStatus.ACTIVE,
      transactionNo: getSnowId(),
      transactionScene: params.scene ?? "",
      transactionType: CreditTransactionType.CONSUME,
      userEmail: params.userEmail ?? "",
      userId,
    };
    await tx.insert(credit).values(consumedCredit);

    return { consumedCredit, success: true };
  } catch (error) {
    await refundBatches(tx, applied).catch(() => undefined);
    throw error;
  }
}

async function refundBatches(tx: BillingTransaction, items: ConsumedDetailItem[]): Promise<void> {
  for (const item of items) {
    await tx
      .update(credit)
      .set({ remainingCredits: sql`${credit.remainingCredits} + ${item.amount}` })
      .where(eq(credit.id, item.creditId));
  }
}

async function consumeInOwnTransaction(
  params: ConsumeCreditsParams,
): Promise<ConsumeCreditsResult> {
  for (let attempt = 1; attempt <= MAX_CONSUME_ATTEMPTS; attempt += 1) {
    try {
      return await d1Transaction(db(), (tx) => consumeWithinTransaction(tx, params));
    } catch (error) {
      if (!(error instanceof CreditContentionError) || attempt === MAX_CONSUME_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("unreachable");
}

export function consume(params: ConsumeCreditsParams): Promise<ConsumeCreditsResult> {
  if (params.tx) {
    return consumeWithinTransaction(params.tx, params);
  }
  return consumeInOwnTransaction(params);
}

export interface RevokeCreditsParams {
  consumeCreditId: string;
}

export async function revoke(params: RevokeCreditsParams): Promise<void> {
  const { consumeCreditId } = params;

  await d1Transaction(db(), async (tx) => {
    const [claimed] = await tx
      .update(credit)
      .set({ status: CreditStatus.DELETED })
      .where(
        and(
          eq(credit.id, consumeCreditId),
          eq(credit.transactionType, CreditTransactionType.CONSUME),
          eq(credit.status, CreditStatus.ACTIVE),
          isNotNull(credit.consumedDetail),
          ne(credit.consumedDetail, ""),
        ),
      )
      .returning({ consumedDetail: credit.consumedDetail, id: credit.id });

    if (!claimed?.consumedDetail) {
      return;
    }

    const items = JSON.parse(claimed.consumedDetail) as ConsumedDetailItem[];

    await refundBatches(tx, items);
  });
}

const DEFAULT_HISTORY_PAGE_SIZE = 50;

export interface GetHistoryOptions {
  limit?: number;
  offset?: number;
}

export function getHistory(userId: string, options?: GetHistoryOptions): Promise<Credit[]> {
  const limit = options?.limit ?? DEFAULT_HISTORY_PAGE_SIZE;
  const offset = options?.offset ?? 0;

  return db()
    .select()
    .from(credit)
    .where(and(eq(credit.userId, userId), isNull(credit.deletedAt)))
    .orderBy(desc(credit.createdAt))
    .limit(limit)
    .offset(offset);
}

const DEFAULT_INITIAL_CREDITS_DESCRIPTION = "Initial credits";

export interface GrantCreditsForNewUserParams {
  userEmail?: string;
  userId: string;
}

export async function grantCreditsForNewUser(
  params: GrantCreditsForNewUserParams,
): Promise<NewCredit | undefined> {
  const { userId, userEmail } = params;

  if (!readBooleanEnv("INITIAL_CREDITS_ENABLED", false)) {
    return;
  }

  const amount = readIntEnv("INITIAL_CREDITS_AMOUNT", 0);
  if (amount <= 0) {
    return;
  }

  const creditsValidDays = readIntEnv("INITIAL_CREDITS_VALID_DAYS", 0);
  const description = readEnv("INITIAL_CREDITS_DESCRIPTION") || DEFAULT_INITIAL_CREDITS_DESCRIPTION;
  const expiresAt = calculateCreditExpirationTime({ creditsValidDays });
  const transactionNo = `welcome-credit:${userId}`;

  try {
    return await grant({
      credits: amount,
      description,
      expiresAt,
      scene: CreditTransactionScene.GIFT,
      transactionNo,
      userEmail,
      userId,
    });
  } catch (error) {
    const [existing] = await db()
      .select()
      .from(credit)
      .where(eq(credit.transactionNo, transactionNo))
      .limit(1);
    if (
      existing?.userId === userId &&
      existing.transactionType === CreditTransactionType.GRANT &&
      existing.transactionScene === CreditTransactionScene.GIFT
    ) {
      return existing;
    }
    throw error;
  }
}
