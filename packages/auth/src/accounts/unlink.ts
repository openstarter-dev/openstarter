import { env as databaseEnv } from "@openstarter/db/env";
import { account, user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { and, eq, gt, sql } from "drizzle-orm";

export type AccountUnlinkCode = "ACCOUNT_NOT_FOUND" | "LAST_ACCOUNT";

export class AccountUnlinkError extends Error {
  readonly code: AccountUnlinkCode;

  constructor(code: AccountUnlinkCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AccountUnlinkError";
  }
}

interface AccountSelector {
  accountId?: string;
  providerId: string;
  userId: string;
}

export interface AccountUnlinkRepository {
  deleteIfMultiple: (params: { accountId: string; userId: string }) => Promise<boolean>;
  findAccount: (params: AccountSelector) => Promise<{ id: string } | null>;
}

const databaseRepository: AccountUnlinkRepository = {
  deleteIfMultiple: async ({ accountId, userId }) => {
    if (databaseEnv.DATABASE_PROVIDER === "d1") {
      // D1 has no interactive transaction. Its SQLite single-writer model
      // serializes this one conditional DELETE, so concurrent requests observe
      // account counts in write order without a check/delete gap.
      const userAccountCount = sql<number>`(
        select count(*) from ${account}
        where ${account.userId} = ${userId}
      )`;
      await db()
        .delete(account)
        .where(and(eq(account.id, accountId), eq(account.userId, userId), gt(userAccountCount, 1)));
      const [remaining] = await db()
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.id, accountId), eq(account.userId, userId)))
        .limit(1);
      return remaining === undefined;
    }

    return db().transaction(async (tx) => {
      // A no-op update acquires the user's write lock on PostgreSQL/MySQL and
      // starts the serialized write transaction on SQLite. Every unlink for
      // the same user must pass this lock before counting accounts.
      await tx
        .update(user)
        .set({ updatedAt: sql`${user.updatedAt}` })
        .where(eq(user.id, userId));

      const userAccounts = await tx
        .select({ id: account.id })
        .from(account)
        .where(eq(account.userId, userId));
      if (userAccounts.length <= 1) {
        return false;
      }

      await tx.delete(account).where(and(eq(account.id, accountId), eq(account.userId, userId)));
      return true;
    });
  },
  findAccount: async ({ accountId, providerId, userId }) => {
    const conditions = [eq(account.userId, userId), eq(account.providerId, providerId)];
    if (accountId !== undefined) {
      conditions.push(eq(account.accountId, accountId));
    }
    const [row] = await db()
      .select({ id: account.id })
      .from(account)
      .where(and(...conditions))
      .limit(1);
    return row ?? null;
  },
};

export async function unlinkAccountWithRepository(
  params: AccountSelector,
  repository: AccountUnlinkRepository,
): Promise<void> {
  const target = await repository.findAccount(params);
  if (!target) {
    throw new AccountUnlinkError("ACCOUNT_NOT_FOUND", "Account not found");
  }

  const deleted = await repository.deleteIfMultiple({
    accountId: target.id,
    userId: params.userId,
  });
  if (!deleted) {
    throw new AccountUnlinkError("LAST_ACCOUNT", "Cannot unlink the last sign-in method");
  }
}

export async function unlinkAccountSafely(params: AccountSelector): Promise<void> {
  await unlinkAccountWithRepository(params, databaseRepository);
}
