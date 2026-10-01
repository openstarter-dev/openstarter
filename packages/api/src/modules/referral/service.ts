// 分销用户端服务：推荐码管理、绑定校验（仅一级）、统计与分页查询。

import { commission, referral, referralRelation } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { count, desc, eq } from "drizzle-orm";

import { CommissionStatus } from "@openstarter/billing-web";

export const BindReferralError = {
  ALREADY_REFERRED: "ALREADY_REFERRED",
  INVALID_CODE: "INVALID_CODE",
  NO_SECOND_LEVEL: "NO_SECOND_LEVEL",
  SELF_REFERRAL: "SELF_REFERRAL",
} as const;
export type BindReferralError = (typeof BindReferralError)[keyof typeof BindReferralError];

/** 惰性生成推荐码：首次访问时为用户建 referral 行（8 位短码，去易混字符）。 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const [existing] = await db().select().from(referral).where(eq(referral.userId, userId)).limit(1);
  if (existing) return existing.code;
  const code = generateReferralCode();
  await db().insert(referral).values({ code, id: getUuid(), userId }).onConflictDoNothing();
  // 并发下 onConflictDoNothing 可能没插入 → 回读一次
  const [row] = await db().select().from(referral).where(eq(referral.userId, userId)).limit(1);
  return row ? row.code : code;
}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 去 0/O/1/I/L
function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** 绑定推荐关系（注册后一次）。返回 { ok: true } 或 { ok: false, error }。 */
export async function bindReferral(params: {
  code: string;
  userId: string;
}): Promise<{ error?: BindReferralError; ok: boolean }> {
  const { code, userId } = params;
  const [codeRow] = await db().select().from(referral).where(eq(referral.code, code)).limit(1);
  if (!codeRow) return { error: BindReferralError.INVALID_CODE, ok: false };
  if (codeRow.userId === userId) return { error: BindReferralError.SELF_REFERRAL, ok: false };

  const [myRelation] = await db()
    .select()
    .from(referralRelation)
    .where(eq(referralRelation.referredUserId, userId))
    .limit(1);
  if (myRelation) return { error: BindReferralError.ALREADY_REFERRED, ok: false };

  // 防二级：码主人自己不能有推荐人。
  const [referrerRelation] = await db()
    .select()
    .from(referralRelation)
    .where(eq(referralRelation.referredUserId, codeRow.userId))
    .limit(1);
  if (referrerRelation) return { error: BindReferralError.NO_SECOND_LEVEL, ok: false };

  await db().insert(referralRelation).values({
    code,
    id: getUuid(),
    referrerId: codeRow.userId,
    referredUserId: userId,
  });
  return { ok: true };
}

/** 我的分销统计。 */
export async function getMyReferralStats(userId: string): Promise<{
  pendingCredits: number;
  referredCount: number;
  settledCredits: number;
  totalCredits: number;
}> {
  const referredCount = await db()
    .select({ value: count() })
    .from(referralRelation)
    .where(eq(referralRelation.referrerId, userId))
    .then((r) => Number(r[0]?.value ?? 0));
  const rows = await db()
    .select({ credits: commission.commissionCredits, status: commission.status })
    .from(commission)
    .where(eq(commission.referrerId, userId));
  const pendingCredits = rows
    .filter((r) => r.status === CommissionStatus.PENDING)
    .reduce((sum, r) => sum + r.credits, 0);
  const settledCredits = rows
    .filter((r) => r.status === CommissionStatus.SETTLED)
    .reduce((sum, r) => sum + r.credits, 0);
  return {
    pendingCredits,
    referredCount,
    settledCredits,
    totalCredits: pendingCredits + settledCredits,
  };
}

export interface ListCommissionsParams {
  page: number;
  pageSize: number;
  userId: string;
}

export interface ListCommissionsResult {
  items: (typeof commission.$inferSelect)[];
  total: number;
}

/** 分页返回当前用户的佣金流水，按创建时间倒序。 */
export async function listMyCommissions(
  params: ListCommissionsParams,
): Promise<ListCommissionsResult> {
  const { userId, page, pageSize } = params;
  const where = eq(commission.referrerId, userId);

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

  return { items, total: totalRows[0]?.value ?? 0 };
}

export interface ListRelationsParams {
  page: number;
  pageSize: number;
  userId: string;
}

export interface ListRelationsResult {
  items: (typeof referralRelation.$inferSelect)[];
  total: number;
}

/** 分页返回当前用户的下级关系，按创建时间倒序。 */
export async function listMyRelations(params: ListRelationsParams): Promise<ListRelationsResult> {
  const { userId, page, pageSize } = params;
  const where = eq(referralRelation.referrerId, userId);

  const [items, totalRows] = await Promise.all([
    db()
      .select()
      .from(referralRelation)
      .where(where)
      .orderBy(desc(referralRelation.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db().select({ value: count() }).from(referralRelation).where(where),
  ]);

  return { items, total: totalRows[0]?.value ?? 0 };
}
