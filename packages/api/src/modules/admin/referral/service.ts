// 分销管理端服务：结算/作废/补记/代理比例/列表/配置读写。

import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  CommissionStatus,
  getReferralConfig,
  REFERRAL_CONFIG_KEY,
  referralConfigSchema,
} from "@openstarter/billing-web";
import { grant } from "@openstarter/billing-web";
import { getUuid } from "@openstarter/shared/id";
import { logger } from "@openstarter/shared/logger";

import { commission, config, referral, referralRelation } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";

// ─── 结算（Settle） ────────────────────────────────────────────────────────────

export async function settleCommission(params: {
  adminUserId: string;
  commissionId: string;
  note?: string;
}): Promise<{
  error?: "NOT_FOUND" | "NOT_PENDING" | "GRANT_FAILED";
  ok: boolean;
  transactionNo?: string;
}> {
  const { adminUserId, commissionId } = params;
  const [claimed] = await db()
    .update(commission)
    .set({ settledAt: new Date(), settledBy: adminUserId, status: CommissionStatus.SETTLED })
    .where(and(eq(commission.id, commissionId), eq(commission.status, CommissionStatus.PENDING)))
    .returning();

  if (!claimed) {
    const [row] = await db()
      .select()
      .from(commission)
      .where(eq(commission.id, commissionId))
      .limit(1);
    if (!row) return { error: "NOT_FOUND", ok: false };
    return { error: "NOT_PENDING", ok: false };
  }

  try {
    const granted = await grant({
      credits: claimed.commissionCredits,
      description: `Referral commission for order ${claimed.orderNo}`,
      orderNo: claimed.orderNo,
      scene: "referral",
      userId: claimed.referrerId,
    });
    await db()
      .update(commission)
      .set({ transactionNo: granted.transactionNo })
      .where(eq(commission.id, commissionId));
    return { ok: true, transactionNo: granted.transactionNo };
  } catch (err) {
    await db()
      .update(commission)
      .set({ settledAt: null, settledBy: null, status: CommissionStatus.PENDING })
      .where(eq(commission.id, commissionId));
    logger.error("[referral] 结算发分失败，已回滚为 pending", err);
    return { error: "GRANT_FAILED", ok: false };
  }
}

// ─── 作废（Void） ──────────────────────────────────────────────────────────────

export async function voidCommission(params: {
  commissionId: string;
}): Promise<{ error?: "NOT_FOUND" | "NOT_PENDING"; ok: boolean }> {
  const { commissionId } = params;
  const [claimed] = await db()
    .update(commission)
    .set({ status: CommissionStatus.VOID })
    .where(and(eq(commission.id, commissionId), eq(commission.status, CommissionStatus.PENDING)))
    .returning();

  if (!claimed) {
    const [row] = await db()
      .select()
      .from(commission)
      .where(eq(commission.id, commissionId))
      .limit(1);
    if (!row) return { error: "NOT_FOUND", ok: false };
    return { error: "NOT_PENDING", ok: false };
  }
  return { ok: true };
}

// ─── 手动补记（Manual Create） ────────────────────────────────────────────────

const manualCreateBody = z.object({
  baseAmount: z.number().int().min(0),
  orderNo: z.string().min(1).max(64),
  rate: z.number().int().min(0).max(5000),
  referredUserId: z.string().min(1),
  referrerId: z.string().min(1),
});

export async function manualCreateCommission(
  input: unknown,
): Promise<{ error?: string; ok: boolean; data?: { id: string } }> {
  const body = manualCreateBody.parse(input);
  const id = getUuid();

  // 幂等：onConflictDoNothing(orderNo)，已存在时回读当前行
  const [inserted] = await db()
    .insert(commission)
    .values({
      baseAmount: body.baseAmount,
      baseCurrency: "usd",
      commissionCredits: Math.round((body.baseAmount * body.rate) / 10000),
      id,
      note: "manual",
      orderNo: body.orderNo,
      rate: body.rate,
      referredUserId: body.referredUserId,
      referrerId: body.referrerId,
      status: CommissionStatus.PENDING,
    })
    .onConflictDoNothing({ target: commission.orderNo })
    .returning();

  if (inserted) {
    return { ok: true, data: { id: inserted.id } };
  }

  // 已存在：回读当前行
  const [existing] = await db()
    .select()
    .from(commission)
    .where(eq(commission.orderNo, body.orderNo))
    .limit(1);
  return { ok: true, data: { id: existing!.id } };
}

// ─── 代理比例（Custom Rate） ───────────────────────────────────────────────────

export async function setCustomRate(params: {
  userId: string;
  customRate: number | null;
}): Promise<{ ok: boolean }> {
  const { userId, customRate } = params;

  // 无 referral 行则先建
  const [existing] = await db().select().from(referral).where(eq(referral.userId, userId)).limit(1);

  if (!existing) {
    const code = generateReferralCode();
    await db()
      .insert(referral)
      .values({ code, customRate, id: getUuid(), userId })
      .onConflictDoNothing();
    return { ok: true };
  }

  await db().update(referral).set({ customRate }).where(eq(referral.userId, userId));
  return { ok: true };
}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// ─── 列表查询 ──────────────────────────────────────────────────────────────────

export interface ListCommissionsParams {
  page: number;
  pageSize: number;
  status?: string;
}

export interface ListCommissionsResult {
  items: (typeof commission.$inferSelect)[];
  total: number;
}

export async function listCommissions(
  params: ListCommissionsParams,
): Promise<ListCommissionsResult> {
  const { page, pageSize, status } = params;
  const where = status ? eq(commission.status, status) : undefined;

  const [items, totalRows] = await Promise.all([
    db()
      .select()
      .from(commission)
      .where(where)
      .orderBy(desc(commission.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db().select({ value: count() }).from(commission).where(where),
  ]);

  return { items, total: Number(totalRows[0]?.value ?? 0) };
}

export interface ListRelationsParams {
  page: number;
  pageSize: number;
}

export interface ListRelationsResult {
  items: (typeof referralRelation.$inferSelect)[];
  total: number;
}

export async function listRelations(params: ListRelationsParams): Promise<ListRelationsResult> {
  const { page, pageSize } = params;

  const [items, totalRows] = await Promise.all([
    db()
      .select()
      .from(referralRelation)
      .orderBy(desc(referralRelation.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db().select({ value: count() }).from(referralRelation),
  ]);

  return { items, total: Number(totalRows[0]?.value ?? 0) };
}

// ─── 配置读写 ──────────────────────────────────────────────────────────────────

export async function getReferralConfigForAdmin(): Promise<ReferralConfigResult> {
  const cfg = await getReferralConfig();
  return { ok: true, data: cfg };
}

export async function saveReferralConfig(input: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const parsed = referralConfigSchema.parse(input);
    const value = JSON.stringify(parsed);
    await db()
      .insert(config)
      .values({ name: REFERRAL_CONFIG_KEY, value })
      .onConflictDoUpdate({ target: config.name, set: { value } });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "validation_failed" };
  }
}

export interface ReferralConfigResult {
  ok: boolean;
  data: z.infer<typeof referralConfigSchema>;
}
