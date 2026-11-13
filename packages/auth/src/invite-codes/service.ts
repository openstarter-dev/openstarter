import { randomBytes } from "node:crypto";
import { env as databaseEnv } from "@openstarter/db/env";
import type { InviteCode } from "@openstarter/db/schema";
import { inviteCode, subscription, userInvite } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const RANDOM_CHUNK_BYTES = 16;
const BYTE_RANGE = 256;

const DEFAULT_MAX_USES = 1;
const DEFAULT_TRIAL_DAYS = 15;
const MS_PER_DAY = 86_400_000;

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

export async function createInviteCode(params: {
  code?: string;
  maxUses?: number;
  trialDays?: number;
  note?: string;
  createdBy?: string;
  expiresAt?: Date | null;
}): Promise<InviteCode | undefined> {
  const [row] = await db().insert(inviteCode).values(buildInviteCodeValues(params)).returning();
  return row;
}

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
    }),
  );
  return db().insert(inviteCode).values(values).returning();
}

export function listInviteCodes(): Promise<InviteCode[]> {
  return db().select().from(inviteCode).orderBy(asc(inviteCode.createdAt));
}

export async function deleteInviteCode(id: string): Promise<void> {
  await db().delete(inviteCode).where(eq(inviteCode.id, id));
}

export interface InviteCodeValidation {
  error?: string;
  inviteCodeId?: string;
  trialDays?: number;
  valid: boolean;
}

export async function validateInviteCode(code: string): Promise<InviteCodeValidation> {
  const [row] = await db().select().from(inviteCode).where(eq(inviteCode.code, code)).limit(1);

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

export interface RedeemResult {
  error?: string;
  ok: boolean;
  trialEndsAt?: Date;
}

async function redeemWithSqliteBatch(params: {
  code: string;
  userId: string;
  now: Date;
  row: InviteCode;
}): Promise<RedeemResult> {
  const database = db();
  const redemptionId = getUuid();
  const trialEndsAt = new Date(params.now.getTime() + params.row.trialDays * MS_PER_DAY);
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
  if (currentCode.expiresAt && currentCode.expiresAt.getTime() <= params.now.getTime()) {
    return { error: "Invite code has expired", ok: false };
  }
  return { error: "Invite code has been fully used", ok: false };
}

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

      const query = tx.select().from(inviteCode).where(eq(inviteCode.code, params.code)).limit(1);
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

      const trialEndsAt = new Date(params.now.getTime() + row.trialDays * MS_PER_DAY);
      await tx
        .update(inviteCode)
        .set({ usedCount: sql`${inviteCode.usedCount} + 1` })
        .where(
          and(
            eq(inviteCode.id, row.id),
            lt(inviteCode.usedCount, inviteCode.maxUses),
            or(isNull(inviteCode.expiresAt), gt(inviteCode.expiresAt, params.now)),
          ),
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
  if (provider === "d1") {
    return redeemWithSqliteBatch({ ...params, now, row });
  }
  return redeemWithLockedTransaction({ ...params, now });
}

export type UserPlan = "none" | "trial" | "expired" | "member";

export async function getUserPlan(userId: string): Promise<{ plan: UserPlan; trialEndsAt?: Date }> {
  const database = db();

  const [activeSub] = await database
    .select()
    .from(subscription)
    .where(and(eq(subscription.userId, userId), eq(subscription.status, "active")))
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
