import type { Database } from "@openstarter/db/server";
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

import { SubscriptionStatus } from "./payment/types";
import { cancelSubscription, createSubscription } from "./subscriptions";
import {
  closeBillingTestDatabase,
  createBillingTestDatabase,
  resetBillingTestDatabase,
} from "./test/billing-test-database";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@openstarter/db/server")>();
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

const FIXED_NOW = new Date("2026-07-30T00:00:00.000Z");
const CANCEL_REASON_REGEX = /^[a-z_]{1,32}$/;

const insertSubscription = async (
  overrides: Partial<{
    subscriptionNo: string;
    userId: string;
    status: string;
  }> = {}
) => {
  const created = await createSubscription({
    currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
    currentPeriodStart: FIXED_NOW,
    paymentProvider: "stripe",
    status:
      (overrides.status as SubscriptionStatus) ?? SubscriptionStatus.ACTIVE,
    subscriptionId: `sub_${overrides.subscriptionNo ?? "1234"}`,
    subscriptionNo: overrides.subscriptionNo ?? "sub-test-1",
    subscriptionResult: "ok",
    userId: overrides.userId ?? "user-1",
  });
  return created;
};

describe("subscription cancellation (Property 23)", () => {
  beforeAll(async () => {
    state.database = await createBillingTestDatabase("subscriptions");
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

  it("cancelSubscription records canceledAt and the provided canceledEndAt, and sets status to canceled by default", async () => {
    await insertSubscription();
    const canceledAt = new Date("2026-08-15T12:00:00.000Z");
    const canceledEndAt = new Date("2026-10-01T00:00:00.000Z");

    const updated = await cancelSubscription({
      canceledAt,
      canceledEndAt,
      subscriptionNo: "sub-test-1",
    });

    expect(updated?.status).toBe(SubscriptionStatus.CANCELED);
    expect(updated?.canceledAt).toEqual(canceledAt);
    expect(updated?.canceledEndAt).toEqual(canceledEndAt);
    expect(updated?.canceledReason).toBe(null);
    expect(updated?.canceledReasonType).toBe(null);
  });

  it("cancelSubscription with explicit pending_cancel status keeps active billing until canceledEndAt", async () => {
    await insertSubscription();
    const canceledAt = new Date("2026-08-15T12:00:00.000Z");
    const periodEnd = new Date("2026-10-01T00:00:00.000Z");

    const updated = await cancelSubscription({
      canceledAt,
      canceledEndAt: periodEnd,
      status: SubscriptionStatus.PENDING_CANCEL,
      subscriptionNo: "sub-test-1",
    });

    expect(updated?.status).toBe(SubscriptionStatus.PENDING_CANCEL);
    expect(updated?.canceledAt).toEqual(canceledAt);
    expect(updated?.canceledEndAt).toEqual(periodEnd);
  });

  it("cancelSubscription with explicit reason records it and the reason type verbatim", async () => {
    await insertSubscription();

    const updated = await cancelSubscription({
      canceledReason: "payment_failed",
      canceledReasonType: "payment_failure",
      subscriptionNo: "sub-test-1",
    });

    expect(updated?.canceledReason).toBe("payment_failed");
    expect(updated?.canceledReasonType).toBe("payment_failure");
    expect(updated?.status).toBe(SubscriptionStatus.CANCELED);
  });

  it("P23 recorded cancellation survives a read-back with identical timestamps and status across many runs", async () => {
    const reasonArbitrary = fc.stringMatching(CANCEL_REASON_REGEX);
    const canceledAtArbitrary = fc.date({
      max: new Date("2100-01-01"),
      min: new Date("2020-01-01"),
    });
    const canceledEndAtArbitrary = fc.date({
      max: new Date("2200-01-01"),
      min: new Date("2020-01-01"),
    });

    await fc.assert(
      fc.asyncProperty(
        reasonArbitrary,
        canceledAtArbitrary,
        canceledEndAtArbitrary,
        fc.boolean(),
        async (reason, canceledAt, canceledEndAt, withReason) => {
          const subscriptionNo = `sub-${reason.slice(0, 12)}`;
          await insertSubscription({ subscriptionNo });

          const updated = await cancelSubscription({
            canceledAt,
            canceledEndAt,
            canceledReason: withReason ? reason : undefined,
            subscriptionNo,
          });

          expect(updated?.canceledAt).toEqual(canceledAt);
          expect(updated?.canceledEndAt).toEqual(canceledEndAt);
          expect(updated?.status).toBe(SubscriptionStatus.CANCELED);
          if (withReason) {
            expect(updated?.canceledReason).toBe(reason);
          } else {
            expect(updated?.canceledReason).toBe(null);
          }

          if (state.database) {
            await resetBillingTestDatabase(state.database);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
