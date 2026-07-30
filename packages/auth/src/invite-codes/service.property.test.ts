import {
  inviteCode,
  subscription,
  user,
  userInvite,
} from "@openstarter/db/schema";
import type { Database } from "@openstarter/db/server";
import { eq } from "drizzle-orm";
import fc from "fast-check";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  closeAuthTestDatabase,
  createAuthTestDatabase,
  resetAuthTestDatabase,
} from "../test/auth-test-database";
import {
  createInviteCode,
  createInviteCodesBatch,
  generateCode,
  getUserPlan,
  redeemInviteCode,
} from "./service";

const FIXED_NOW = new Date("2026-07-24T00:00:00.000Z");
const MS_PER_DAY = 86_400_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{12}$/u;
const REJECTION_ERROR_PATTERN = /invalid|expired|fully used/iu;
const PROPERTY_RUNS = 100;
const PROPERTY_TEST_TIMEOUT_MS = 30_000;
const PROPERTY_OPTIONS = {
  numRuns: PROPERTY_RUNS,
  seed: 20_260_724,
} as const;

const state = vi.hoisted(() => ({
  caseSequence: 0,
  codeByte: 0,
  database: undefined as Database | undefined,
  idSequence: 0,
  provider: "sqlite" as string,
  uniformCodeBytes: false,
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomBytes: (size: number) => {
      if (state.uniformCodeBytes) {
        const bytes = Buffer.alloc(size, state.codeByte % CODE_ALPHABET.length);
        state.codeByte += 1;
        return bytes;
      }

      const bytes = Buffer.alloc(size);
      let value = state.codeByte;
      let index = 0;
      while (index < size) {
        bytes[index] = value % CODE_ALPHABET.length;
        value = Math.floor(value / CODE_ALPHABET.length);
        index += 1;
      }
      state.codeByte += 1;
      return bytes;
    },
  };
});

vi.mock("@openstarter/shared/id", () => ({
  getUuid: () => {
    state.idSequence += 1;
    return `test-id-${state.idSequence}`;
  },
}));

vi.mock("@openstarter/db/env", () => ({
  env: new Proxy(
    {},
    {
      get: (_target, property) =>
        property === "DATABASE_PROVIDER" ? state.provider : undefined,
    }
  ),
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("Test database is not initialized");
      }
      return state.database;
    },
  };
});

const insertUser = (userId: string) => {
  if (!state.database) {
    throw new Error("Test database is not initialized");
  }
  return state.database.insert(user).values({
    createdAt: FIXED_NOW,
    email: `${userId}@example.com`,
    emailVerified: true,
    id: userId,
    name: userId,
    updatedAt: FIXED_NOW,
  });
};

const codeForRun = (run: number) => `CODE${run.toString().padStart(8, "0")}`;

beforeAll(async () => {
  state.database = await createAuthTestDatabase("invite-codes");
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  state.caseSequence = 0;
  state.codeByte = 0;
  state.idSequence = 0;
  state.provider = "sqlite";
  state.uniformCodeBytes = false;
  if (state.database) {
    await resetAuthTestDatabase(state.database);
  }
});

afterAll(() => {
  vi.useRealTimers();
  if (state.database) {
    closeAuthTestDatabase(state.database);
  }
});

describe("invite code properties", () => {
  it("P15 invite batch preserves count and configured fields for nullable expiry", async () => {
    const creatorId = "batch-creator";
    await insertUser(creatorId);
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 12, min: 1 }),
        fc.integer({ max: 20, min: 1 }),
        fc.integer({ max: 365, min: 1 }),
        fc.string({ maxLength: 40 }),
        fc.option(fc.integer({ max: 365, min: 1 }), { nil: null }),
        async (count, maxUses, trialDays, note, expiryOffsetDays) => {
          const expiresAt =
            expiryOffsetDays === null
              ? null
              : new Date(FIXED_NOW.getTime() + expiryOffsetDays * MS_PER_DAY);

          const rows = await createInviteCodesBatch({
            count,
            createdBy: creatorId,
            expiresAt,
            maxUses,
            note,
            trialDays,
          });

          expect(rows).toHaveLength(count);
          expect(new Set(rows.map((row) => row.code)).size).toBe(count);
          for (const row of rows) {
            expect(row).toMatchObject({
              createdBy: creatorId,
              expiresAt,
              maxUses,
              note,
              trialDays,
              usedCount: 0,
            });
            expect(row.code).toMatch(CODE_PATTERN);
          }
        }
      ),
      PROPERTY_OPTIONS
    );
  });

  it("P16 generated codes have fixed charset and unbiased symbol mapping", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: CODE_ALPHABET.length - 1, min: 0 }),
        (offset) => {
          state.codeByte = offset;
          state.uniformCodeBytes = true;
          const codes = Array.from({ length: CODE_ALPHABET.length }, () =>
            generateCode()
          );
          const frequencies = new Map(
            [...CODE_ALPHABET].map((symbol) => [symbol, 0])
          );

          for (const code of codes) {
            expect(code).toHaveLength(12);
            expect(code).toMatch(CODE_PATTERN);
            for (const symbol of code) {
              frequencies.set(symbol, (frequencies.get(symbol) ?? 0) + 1);
            }
          }

          expect([...frequencies.values()]).toEqual(
            Array.from({ length: CODE_ALPHABET.length }, () => 12)
          );
        }
      ),
      PROPERTY_OPTIONS
    );
  });

  it("P17 redemption increments once and derives trial end from stored activation", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ max: 365, min: 1 }), async (trialDays) => {
        if (!state.database) {
          throw new Error("Test database is not initialized");
        }
        state.caseSequence += 1;
        const userId = `user-${state.caseSequence}`;
        const code = codeForRun(state.caseSequence);
        await insertUser(userId);
        await createInviteCode({ code, maxUses: 3, trialDays });

        const result = await redeemInviteCode({ code, userId });
        const [storedCode] = await state.database
          .select()
          .from(inviteCode)
          .where(eq(inviteCode.code, code));
        const [storedRedemption] = await state.database
          .select()
          .from(userInvite)
          .where(eq(userInvite.userId, userId));
        if (!storedRedemption) {
          throw new Error("Expected redemption to be stored");
        }
        const expectedTrialEnd = new Date(
          storedRedemption.activatedAt.getTime() + trialDays * MS_PER_DAY
        );

        expect(result).toEqual({ ok: true, trialEndsAt: expectedTrialEnd });
        expect(storedCode?.usedCount).toBe(1);
        expect(storedRedemption.trialEndsAt).toEqual(expectedTrialEnd);
      }),
      PROPERTY_OPTIONS
    );
  });

  it("P18 invalid, expired, and exhausted rejection never changes used counts", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("invalid", "expired", "exhausted"),
        async (scenario) => {
          if (!state.database) {
            throw new Error("Test database is not initialized");
          }
          state.caseSequence += 1;
          const userId = `user-${state.caseSequence}`;
          const code = codeForRun(state.caseSequence);
          await insertUser(userId);

          if (scenario === "expired") {
            await createInviteCode({ code, expiresAt: FIXED_NOW });
          } else if (scenario === "exhausted") {
            const row = await createInviteCode({ code, maxUses: 1 });
            if (!row) {
              throw new Error("Expected invite code to be created");
            }
            await state.database
              .update(inviteCode)
              .set({ usedCount: 1 })
              .where(eq(inviteCode.id, row.id));
          }

          const countsBefore = (await state.database.select().from(inviteCode))
            .map((row) => [row.id, row.usedCount] as const)
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
          const result = await redeemInviteCode({ code, userId });
          const countsAfter = (await state.database.select().from(inviteCode))
            .map((row) => [row.id, row.usedCount] as const)
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
          const redemptions = await state.database
            .select()
            .from(userInvite)
            .where(eq(userInvite.userId, userId));

          expect(result.ok).toBe(false);
          expect(result.error).toMatch(REJECTION_ERROR_PATTERN);
          expect(countsAfter).toEqual(countsBefore);
          expect(redemptions).toHaveLength(0);
        }
      ),
      PROPERTY_OPTIONS
    );
  });

  it(
    "P19 any same-user redemption after the first leaves every code count unchanged",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ max: 365, min: 1 }),
          fc.boolean(),
          async (trialDays, useSecondCode) => {
            if (!state.database) {
              throw new Error("Test database is not initialized");
            }
            state.caseSequence += 1;
            const userId = `user-${state.caseSequence}`;
            const firstCode = codeForRun(state.caseSequence * 2);
            const secondCode = codeForRun(state.caseSequence * 2 + 1);
            await insertUser(userId);
            await createInviteCode({ code: firstCode, maxUses: 20, trialDays });
            await createInviteCode({
              code: secondCode,
              maxUses: 20,
              trialDays,
            });

            const firstResult = await redeemInviteCode({
              code: firstCode,
              userId,
            });
            const countsAfterFirst = (
              await state.database.select().from(inviteCode)
            )
              .map((row) => [row.id, row.usedCount] as const)
              .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
            const repeatedResult = await redeemInviteCode({
              code: useSecondCode ? secondCode : firstCode,
              userId,
            });
            const countsAfterRepeat = (
              await state.database.select().from(inviteCode)
            )
              .map((row) => [row.id, row.usedCount] as const)
              .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
            const redemptions = await state.database
              .select()
              .from(userInvite)
              .where(eq(userInvite.userId, userId));

            expect(firstResult.ok).toBe(true);
            expect(repeatedResult).toEqual(firstResult);
            expect(countsAfterRepeat).toEqual(countsAfterFirst);
            expect(redemptions).toHaveLength(1);
          }
        ),
        PROPERTY_OPTIONS
      );
    },
    PROPERTY_TEST_TIMEOUT_MS
  );

  it("P20 active subscription wins over any trial, expired, or absent invite state", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.constantFrom("none", "trial", "expired"),
        fc.integer({ max: 365, min: 1 }),
        async (hasActiveSubscription, inviteState, offsetDays) => {
          if (!state.database) {
            throw new Error("Test database is not initialized");
          }
          state.caseSequence += 1;
          const caseId = state.caseSequence;
          const userId = `user-${caseId}`;
          await insertUser(userId);

          if (hasActiveSubscription) {
            await state.database.insert(subscription).values({
              createdAt: FIXED_NOW,
              id: `subscription-${caseId}`,
              paymentProvider: "test",
              status: "active",
              subscriptionId: `provider-subscription-${caseId}`,
              subscriptionNo: `subscription-no-${caseId}`,
              updatedAt: FIXED_NOW,
              userId,
            });
          }
          if (inviteState !== "none") {
            const code = codeForRun(caseId);
            const row = await createInviteCode({ code });
            if (!row) {
              throw new Error("Expected invite code to be created");
            }
            const direction = inviteState === "trial" ? 1 : -1;
            await state.database.insert(userInvite).values({
              activatedAt: FIXED_NOW,
              id: `redemption-${caseId}`,
              inviteCodeId: row.id,
              trialEndsAt: new Date(
                FIXED_NOW.getTime() + direction * offsetDays * MS_PER_DAY
              ),
              userId,
            });
          }

          const result = await getUserPlan(userId);
          const expectedPlan = hasActiveSubscription ? "member" : inviteState;

          expect(result.plan).toBe(expectedPlan);
          if (!hasActiveSubscription && inviteState !== "none") {
            expect(result.trialEndsAt).toBeInstanceOf(Date);
          } else {
            expect(result.trialEndsAt).toBeUndefined();
          }
        }
      ),
      PROPERTY_OPTIONS
    );
  });
});

describe("invite code concurrency", () => {
  it("uses the D1 batch path when the same user races different codes", async () => {
    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    state.provider = "d1";
    const userId = "same-user-race";
    const firstCode = "RACEFIRST001";
    const secondCode = "RACESECON002";
    await insertUser(userId);
    await createInviteCode({ code: firstCode, maxUses: 1, trialDays: 7 });
    await createInviteCode({ code: secondCode, maxUses: 1, trialDays: 30 });

    const settledResults = await Promise.allSettled([
      redeemInviteCode({ code: firstCode, userId }),
      redeemInviteCode({ code: secondCode, userId }),
    ]);
    const storedCodes = await state.database.select().from(inviteCode);
    const redemptions = await state.database
      .select()
      .from(userInvite)
      .where(eq(userInvite.userId, userId));

    expect(
      settledResults.every(
        (result) => result.status === "fulfilled" && result.value.ok
      )
    ).toBe(true);
    expect(redemptions).toHaveLength(1);
    expect(storedCodes.reduce((total, row) => total + row.usedCount, 0)).toBe(
      1
    );
  });

  it("allows only one user to claim the final use", async () => {
    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    const code = "FINALSLOT001";
    const userIds = ["final-slot-user-a", "final-slot-user-b"] as const;
    await Promise.all(userIds.map((userId) => insertUser(userId)));
    await createInviteCode({ code, maxUses: 1 });

    const settledResults = await Promise.allSettled(
      userIds.map((userId) => redeemInviteCode({ code, userId }))
    );
    const fulfilledResults = settledResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const [storedCode] = await state.database
      .select()
      .from(inviteCode)
      .where(eq(inviteCode.code, code));
    const redemptions = await state.database.select().from(userInvite);

    expect(fulfilledResults).toHaveLength(2);
    expect(fulfilledResults.filter((result) => result.ok)).toHaveLength(1);
    expect(fulfilledResults.filter((result) => !result.ok)).toHaveLength(1);
    expect(storedCode?.usedCount).toBe(1);
    expect(redemptions).toHaveLength(1);
  });
});
