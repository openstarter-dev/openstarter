// packages/auth/src/invite-codes/service —— 邀请码与试用服务（R9）。
//
// 生成（CSPRNG + 拒绝采样消除取模偏差）、批量创建、校验、幂等兑换（事务内计数递增 +
// 试用截止计算）与用户方案状态判定。对齐 ShipAny `modules/invite-codes`。
//
// 数据访问：`@openstarter/db/server` 的 `db()` + `@openstarter/db/schema`；兑换与多步写
// 在单个事务内完成（R9.3）。

import { randomBytes } from "node:crypto";
import { env as databaseEnv } from "@openstarter/db/env";
import type { InviteCode } from "@openstarter/db/schema";
import { inviteCode, subscription, userInvite } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

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
    code: params.code || generateCode(),
    createdBy: params.createdBy ?? null,
    expiresAt: params.expiresAt ?? null,
    id: getUuid(),
    maxUses: params.maxUses ?? DEFAULT_MAX_USES,
    note: params.note ?? "",
    trialDays: params.trialDays ?? DEFAULT_TRIAL_DAYS,
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
      createdBy: params.createdBy,
      expiresAt: params.expiresAt,
      maxUses: params.maxUses,
      note: params.note,
      trialDays: params.trialDays,
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
  error?: string;
  inviteCodeId?: string;
  trialDays?: number;
  valid: boolean;
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
    return { error: "Invalid invite code", valid: false };
  }
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return { error: "Invite code has expired", valid: false };
  }
  if (row.usedCount >= row.maxUses) {
    return { error: "Invite code has been fully used", valid: false };
  }

  return { inviteCodeId: row.id, trialDays: row.trialDays, valid: true };
}

/** 邀请码兑换结果。 */
export interface RedeemResult {
  error?: string;
  ok: boolean;
  trialEndsAt?: Date;
}

/**
 * SQLite / Turso / D1 的单批原子兑换。
 *
 * 第一条条件写仅在邀请码仍有效、有余量且用户尚未兑换时插入本次 attempt；第二条只为
 * 该 attempt 递增计数。D1 的 `batch` 由绑定原生实现为单个原子事务，不依赖交互事务。
 */
async function redeemWithSqliteBatch(params: {
  code: string;
  userId: string;
  now: Date;
  row: InviteCode;
}): Promise<RedeemResult> {
  const database = db();
  const redemptionId = getUuid();
  const trialEndsAt = new Date(
    params.now.getTime() + params.row.trialDays * MS_PER_DAY
  );
  const insertRedemption = database.run(sql`
    insert or ignore into ${userInvite}
      (id, user_id, invite_code_id, activated_at, trial_ends_at)
    select
      ${sql.param(redemptionId, userInvite.id)},
      ${sql.param(params.userId, userInvite.userId)},
      ${inviteCode.id},
      ${sql.param(params.now, userInvite.activatedAt)},
      ${sql.param(trialEndsAt, userInvite.trialEndsAt)}
    from ${inviteCode}
    where ${inviteCode.code} = ${params.code}
      and (${inviteCode.expiresAt} is null or ${inviteCode.expiresAt} > ${sql.param(params.now, inviteCode.expiresAt)})
      and ${inviteCode.usedCount} < ${inviteCode.maxUses}
      and not exists (
        select 1 from ${userInvite}
        where ${userInvite.userId} = ${params.userId}
      )
  `);
  const incrementUse = database.run(sql`
    update ${inviteCode}
    set used_count = used_count + 1
    where ${inviteCode.id} = (
      select ${userInvite.inviteCodeId}
      from ${userInvite}
      where ${userInvite.id} = ${redemptionId}
    )
      and ${inviteCode.usedCount} < ${inviteCode.maxUses}
      and (${inviteCode.expiresAt} is null or ${inviteCode.expiresAt} > ${sql.param(params.now, inviteCode.expiresAt)})
  `);

  await database.batch([insertRedemption, incrementUse]);

  const [stored] = await database
    .select()
    .from(userInvite)
    .where(eq(userInvite.userId, params.userId))
    .limit(1);
  if (stored) {
    return { ok: true, trialEndsAt: stored.trialEndsAt };
  }

  const [currentCode] = await database
    .select()
    .from(inviteCode)
    .where(eq(inviteCode.code, params.code))
    .limit(1);
  if (!currentCode) {
    return { error: "Invalid invite code", ok: false };
  }
  if (
    currentCode.expiresAt &&
    currentCode.expiresAt.getTime() <= params.now.getTime()
  ) {
    return { error: "Invite code has expired", ok: false };
  }
  return { error: "Invite code has been fully used", ok: false };
}

/** PostgreSQL / MySQL 的行锁事务兑换。 */
async function redeemWithLockedTransaction(params: {
  code: string;
  userId: string;
  now: Date;
}): Promise<RedeemResult> {
  const database = db();
  try {
    return await database.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(userInvite)
        .where(eq(userInvite.userId, params.userId))
        .limit(1);
      if (existing) {
        return { ok: true, trialEndsAt: existing.trialEndsAt };
      }

      const query = tx
        .select()
        .from(inviteCode)
        .where(eq(inviteCode.code, params.code))
        .limit(1);
      const lockableQuery = query as typeof query & {
        for: (strength: "update") => typeof query;
      };
      const [row] = await lockableQuery.for("update");
      if (!row) {
        return { error: "Invalid invite code", ok: false };
      }
      if (row.expiresAt && row.expiresAt.getTime() <= params.now.getTime()) {
        return { error: "Invite code has expired", ok: false };
      }
      if (row.usedCount >= row.maxUses) {
        return { error: "Invite code has been fully used", ok: false };
      }

      const trialEndsAt = new Date(
        params.now.getTime() + row.trialDays * MS_PER_DAY
      );
      await tx
        .update(inviteCode)
        .set({ usedCount: sql`${inviteCode.usedCount} + 1` })
        .where(
          and(
            eq(inviteCode.id, row.id),
            lt(inviteCode.usedCount, inviteCode.maxUses),
            or(
              isNull(inviteCode.expiresAt),
              gt(inviteCode.expiresAt, params.now)
            )
          )
        );
      await tx.insert(userInvite).values({
        activatedAt: params.now,
        id: getUuid(),
        inviteCodeId: row.id,
        trialEndsAt,
        userId: params.userId,
      });

      return { ok: true, trialEndsAt };
    });
  } catch (error) {
    const [existing] = await database
      .select()
      .from(userInvite)
      .where(eq(userInvite.userId, params.userId))
      .limit(1);
    if (existing) {
      return { ok: true, trialEndsAt: existing.trialEndsAt };
    }
    throw error;
  }
}

/**
 * 原子兑换邀请码。R9.3/R9.4/R9.5
 *
 * `user_invite.user_id` 唯一约束提供最终幂等保证；SQLite/Turso/D1 使用原生单批原子路径，
 * PostgreSQL/MySQL 使用行锁事务与 `used_count < max_uses` 条件更新，防止最后名额超卖。
 */
export async function redeemInviteCode(params: {
  userId: string;
  code: string;
}): Promise<RedeemResult> {
  const now = new Date(Date.now());
  const database = db();
  const [existing] = await database
    .select()
    .from(userInvite)
    .where(eq(userInvite.userId, params.userId))
    .limit(1);
  if (existing) {
    return { ok: true, trialEndsAt: existing.trialEndsAt };
  }

  const [row] = await database
    .select()
    .from(inviteCode)
    .where(eq(inviteCode.code, params.code))
    .limit(1);
  if (!row) {
    return { error: "Invalid invite code", ok: false };
  }
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
    return { error: "Invite code has expired", ok: false };
  }
  if (row.usedCount >= row.maxUses) {
    return { error: "Invite code has been fully used", ok: false };
  }

  const provider = databaseEnv.DATABASE_PROVIDER;
  if (provider === "d1" || provider === "sqlite" || provider === "turso") {
    return redeemWithSqliteBatch({ ...params, now, row });
  }
  return redeemWithLockedTransaction({ ...params, now });
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
