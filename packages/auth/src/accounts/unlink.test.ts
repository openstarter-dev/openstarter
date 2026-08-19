import { describe, expect, it } from "vitest";

import {
  AccountUnlinkError,
  type AccountUnlinkRepository,
  unlinkAccountWithRepository,
} from "./unlink";

interface LinkedAccount {
  accountId: string;
  id: string;
  providerId: string;
  userId: string;
}

const createRepository = (accounts: LinkedAccount[]) => {
  const repository: AccountUnlinkRepository = {
    deleteIfMultiple: ({ accountId, userId }) => {
      const userAccounts = accounts.filter((account) => account.userId === userId);
      if (userAccounts.length <= 1) {
        return Promise.resolve(false);
      }
      const index = accounts.findIndex(
        (account) => account.id === accountId && account.userId === userId,
      );
      if (index === -1) {
        return Promise.resolve(true);
      }
      accounts.splice(index, 1);
      return Promise.resolve(true);
    },
    findAccount: ({ accountId, providerId, userId }) =>
      Promise.resolve(
        accounts.find(
          (account) =>
            account.userId === userId &&
            account.providerId === providerId &&
            (accountId === undefined || account.accountId === accountId),
        ) ?? null,
      ),
  };
  return repository;
};

describe("atomic account unlink", () => {
  it("never removes both sign-in methods under concurrent requests", async () => {
    const accounts = [
      {
        accountId: "google-account",
        id: "google-row",
        providerId: "google",
        userId: "user-1",
      },
      {
        accountId: "user@example.com",
        id: "credential-row",
        providerId: "credential",
        userId: "user-1",
      },
    ];
    const repository = createRepository(accounts);

    const results = await Promise.allSettled([
      unlinkAccountWithRepository(
        {
          accountId: "google-account",
          providerId: "google",
          userId: "user-1",
        },
        repository,
      ),
      unlinkAccountWithRepository(
        {
          accountId: "user@example.com",
          providerId: "credential",
          userId: "user-1",
        },
        repository,
      ),
    ]);

    expect(accounts).toHaveLength(1);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection?.status).toBe("rejected");
    if (rejection?.status === "rejected") {
      expect(rejection.reason).toBeInstanceOf(AccountUnlinkError);
      expect((rejection.reason as AccountUnlinkError).code).toBe("LAST_ACCOUNT");
    }
  });

  it("rejects unlinking the only sign-in method", async () => {
    const accounts = [
      {
        accountId: "google-account",
        id: "google-row",
        providerId: "google",
        userId: "user-1",
      },
    ];

    await expect(
      unlinkAccountWithRepository(
        {
          accountId: "google-account",
          providerId: "google",
          userId: "user-1",
        },
        createRepository(accounts),
      ),
    ).rejects.toMatchObject({ code: "LAST_ACCOUNT" });
    expect(accounts).toHaveLength(1);
  });
});
