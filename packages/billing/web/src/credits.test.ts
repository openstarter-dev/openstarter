import type { Database } from "@openstarter/db/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { consume, getBalance, grant, revoke } from "./credits";
import {
  closeBillingTestDatabase,
  createBillingTestDatabase,
  resetBillingTestDatabase,
} from "./test/billing-test-database";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("billing test database not initialized");
      }
      return state.database;
    },
  };
});

const USER_ID = "credit-test-user";

async function seedGrant(credits: number): Promise<void> {
  await grant({ credits, userId: USER_ID });
}

describe("credits concurrency", () => {
  beforeAll(async () => {
    state.database = await createBillingTestDatabase("credits");
  });

  afterAll(() => {
    if (state.database) {
      closeBillingTestDatabase(state.database);
    }
  });

  beforeEach(async () => {
    if (state.database) {
      await resetBillingTestDatabase(state.database);
    }
  });

  it("deducts FIFO and writes a consume record", async () => {
    await seedGrant(100);

    const result = await consume({ credits: 40, description: "test", userId: USER_ID });

    expect(result.success).toBe(true);
    expect(result.consumedCredit?.credits).toBe(-40);
    await expect(getBalance(USER_ID)).resolves.toBe(60);
  });

  it("rejects a consume that exceeds the balance without changing it", async () => {
    await seedGrant(10);

    const result = await consume({ credits: 20, userId: USER_ID });

    expect(result.success).toBe(false);
    await expect(getBalance(USER_ID)).resolves.toBe(10);
  });

  it("revokes a consume only once, even when called twice", async () => {
    await seedGrant(100);
    const consumed = await consume({ credits: 40, userId: USER_ID });
    const consumeCreditId = consumed.consumedCredit?.id;
    expect(consumeCreditId).toBeDefined();

    await revoke({ consumeCreditId: consumeCreditId as string });
    await revoke({ consumeCreditId: consumeCreditId as string });

    await expect(getBalance(USER_ID)).resolves.toBe(100);
  });

  it("does not double-refund concurrent revokes", async () => {
    await seedGrant(100);
    const consumed = await consume({ credits: 40, userId: USER_ID });
    const consumeCreditId = consumed.consumedCredit?.id as string;

    await Promise.allSettled([revoke({ consumeCreditId }), revoke({ consumeCreditId })]);

    await expect(getBalance(USER_ID)).resolves.toBe(100);
  });

  it("does not overdraw when two consumes race", async () => {
    await seedGrant(100);

    const results = await Promise.allSettled([
      consume({ credits: 60, userId: USER_ID }),
      consume({ credits: 60, userId: USER_ID }),
    ]);

    const successes = results.filter(
      (result) => result.status === "fulfilled" && result.value.success,
    ).length;

    // SQLite/libsql may reject one contender with SQLITE_BUSY; the invariant is
    // that at most one consume commits and the balance never goes negative.
    expect(successes).toBeLessThanOrEqual(1);
    await expect(getBalance(USER_ID)).resolves.toBe(100 - successes * 60);
  });
});
