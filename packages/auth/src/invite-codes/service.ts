// packages/auth/src/invite-codes/service —— 邀请码与试用服务（R9）。
//
// 生成（CSPRNG + 拒绝采样消除取模偏差）、批量创建、校验、幂等兑换（事务内计数递增 +
// 试用截止计算）与用户方案状态判定。对齐 ShipAny `modules/invite-codes`。
//
// 数据访问：`@openstarter/db/server` 的 `db()` + `@openstarter/db/schema`；兑换与多步写
// 在单个事务内完成（R9.3）。

import { inviteCode, subscription, userInvite } from "@openstarter/db/schema";
import type { InviteCode } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

// 邀请码字母表：32 个无易混字符（去除 I/O/0/1 等），长度用于拒绝采样计算。
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const RANDOM_CHUNK_BYTES = 16;
const BYTE_RANGE = 256;

const DEFAULT_MAX_USES = 1;
const DEFAULT_TRIAL_DAYS = 15;
const MS_PER_DAY = 86_400_000;

/**
 * 生成邀请码：从 32 符号字母表取 12 位（约 60 bit 熵）。
 *
 * 用 `randomBytes`（CSPRNG）逐字节采样，**拒绝采样**丢弃落在 `[BYTE_RANGE - BYTE_RANGE %
 * len, BYTE_RANGE)` 的字节以消除取模偏差（此处 len=32 整除 256，实际不丢弃，但保留结构）。R9.2
 */
export function generateCode(): string {
  const limit = BYTE_RANGE - (BYTE_RANGE % CODE_ALPHABET.length);
  const out: string[] = [];
  while (out.length < CODE_LENGTH) {
    for (const b of randomBytes(RANDOM_CHUNK_BYTES)) {
      if (out.length >= CODE_LENGTH) {
        break;
      }
      if (b < limit) {
        out.push(CODE_ALPHABET.charAt(b % CODE_ALPHABET.length));
      }
    }
  }
  return out.join("");
}

/** 组装一条邀请码的插入值（含默认与可选自定义码值/过期时间）。 */
function buildInviteCodeValues(params: {
  code?: string;
  maxUses?: number;
  trialDays?: number;
  note?: string;
  createdBy?: string;
  expiresAt?: Date | null;
}) {
  return {
    id: getUuid(),
    code: params.code || generateCode(),
    maxUses: params.maxUses ?? DEFAULT_MAX_USES,
    trialDays: params.trialDays ?? DEFAULT_TRIAL_DAYS,
    note: params.note ?? "",
    createdBy: params.createdBy ?? null,
    expiresAt: params.expiresAt ?? null,
  };
}

/** 创建单个邀请码（未提供 code 时自动生成）。R9.1/R9.2 */
export async function createInviteCode(params: {
  code?: string;
  maxUses?: number;
  trialDays?: number;
  note?: string;
  createdBy?: string;
  expiresAt?: Date | null;
}): Promise<InviteCode | undefined> {
  const [row] = await db()
    .insert(inviteCode)
    .values(buildInviteCodeValues(params))
    .returning();
  return row;
}

/**
 * 批量创建邀请码：按 `count` 生成 N 条，各自持久化 `maxUses`/`trialDays`/可选过期时间。R9.1
 *
 * 一次性构建全部插入值并单次写入（避免循环内逐条 await）。
 */
export function createInviteCodesBatch(params: {
  count: number;
  maxUses?: number;
  trialDays?: number;
  note?: string;
  createdBy?: string;
  expiresAt?: Date | null;
}): Promise<InviteCode[]> {
  const values = Array.from({ length: params.count }, () =>
    buildInviteCodeValues({
      maxUses: params.maxUses,
      trialDays: params.trialDays,
      note: params.note,
      createdBy: params.createdBy,
      expiresAt: params.expiresAt,
    })
  );
  return db().insert(inviteCode).values(values).returning();
}

/** 列出全部邀请码（按创建时间升序）。 */
export function listInviteCodes(): Promise<InviteCode[]> {
  return db().select().from(inviteCode).orderBy(asc(inviteCode.createdAt));
}

/** 删除邀请码。 */
export async function deleteInviteCode(id: string): Promise<void> {
  await db().delete(inviteCode).where(eq(inviteCode.id, id));
}

/** 邀请码校验结果。 */
export interface InviteCodeValidation {
  valid: boolean;
  error?: string;
  inviteCodeId?: string;
  trialDays?: number;
}

/**
 * 校验邀请码是否可兑换（存在、未过期、未用尽）。R9.4
 */
export async function validateInviteCode(
  code: string
): Promise<InviteCodeValidation> {
  const [row] = await db()
    .select()
    .from(inviteCode)
    .where(eq(inviteCode.code, code))
    .limit(1);

  if (!row) {
    return { valid: false, error: "Invalid invite code" };
  }
  if (row.expiresAt && row.expiresAt < new Date()) {
    return { valid: false, error: "Invite code has expired" };
  }
  if (row.usedCount >= row.maxUses) {
    return { valid: false, error: "Invite code has been fully used" };
  }

  return { valid: true, inviteCodeId: row.id, trialDays: row.trialDays };
}

/** 邀请码兑换结果。 */
export interface RedeemResult {
  ok: boolean;
  error?: string;
  trialEndsAt?: Date;
}

/**
 * 原子兑换邀请码。R9.3/R9.4/R9.5
 *
 * 事务内：
 *   1. 幂等——若该用户已有 `user_invite`，直接返回既有 `trialEndsAt`，不递增任何计数；
 *   2. 校验邀请码存在 / 未过期 / `usedCount < maxUses`，否则拒绝并返回原因；
 *   3. 同一事务插入 `user_invite`（`trialEndsAt = now + trialDays 天`）并 `usedCount += 1`。
 *
 * 说明：规范 Database 类型为 libsql（sqlite 家族），其查询构造器不暴露 `.for('update')`，
 * 且 sqlite 事务本身串行化写；跨方言的行锁差异由连接层兼容代理吸收，故此处依赖事务原子性
 * 与幂等前置检查保证不重复兑换。
 */
export function redeemInviteCode(params: {
  userId: string;
  code: string;
}): Promise<RedeemResult> {
  return db().transaction(async (tx) => {
    // 1. 幂等：用户已有兑换记录 → 返回既有 trialEndsAt，不递增。
    const [existing] = await tx
      .select()
      .from(userInvite)
      .where(eq(userInvite.userId, params.userId))
      .limit(1);
    if (existing) {
      return { ok: true, trialEndsAt: existing.trialEndsAt };
    }

    // 2. 校验邀请码。
    const [row] = await tx
      .select()
      .from(inviteCode)
      .where(eq(inviteCode.code, params.code))
      .limit(1);
    if (!row) {
      return { ok: false, error: "Invalid invite code" };
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      return { ok: false, error: "Invite code has expired" };
    }
    if (row.usedCount >= row.maxUses) {
      return { ok: false, error: "Invite code has been fully used" };
    }

    // 3. 插入兑换记录并递增计数（同一事务）。
    const trialEndsAt = new Date(Date.now() + row.trialDays * MS_PER_DAY);
    await tx.insert(userInvite).values({
      id: getUuid(),
      userId: params.userId,
      inviteCodeId: row.id,
      activatedAt: new Date(),
      trialEndsAt,
    });
    await tx
      .update(inviteCode)
      .set({ usedCount: sql`${inviteCode.usedCount} + 1` })
      .where(eq(inviteCode.id, row.id));

    return { ok: true, trialEndsAt };
  });
}

/** 用户方案状态。 */
export type UserPlan = "none" | "trial" | "expired" | "member";

/**
 * 判定用户方案状态。R9.6/R11.5
 *
 * `active` 订阅 → `member`；否则依 `user_invite`：无 → `none`，
 * `trialEndsAt > now` → `trial`，否则 → `expired`。
 */
export async function getUserPlan(
  userId: string
): Promise<{ plan: UserPlan; trialEndsAt?: Date }> {
  const database = db();

  const [activeSub] = await database
    .select()
    .from(subscription)
    .where(
      and(eq(subscription.userId, userId), eq(subscription.status, "active"))
    )
    .limit(1);
  if (activeSub) {
    return { plan: "member" };
  }

  const [invite] = await database
    .select()
    .from(userInvite)
    .where(eq(userInvite.userId, userId))
    .limit(1);
  if (!invite) {
    return { plan: "none" };
  }

  if (invite.trialEndsAt > new Date()) {
    return { plan: "trial", trialEndsAt: invite.trialEndsAt };
  }
  return { plan: "expired", trialEndsAt: invite.trialEndsAt };
}
