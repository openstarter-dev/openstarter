// Dashboard stats service tests: in-memory SQLite (reuses src/test harness),
// seeds credit / order / apikey rows and asserts aggregation semantics and
// per-user scoping (dashboard data must never leak across users).

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@openstarter/db";
import { db } from "@openstarter/db/server";
import {
  closeApiTestDatabase,
  createApiTestDatabase,
  insertUser,
  resetApiTestDatabase,
} from "../../test/api-test-database";
import { getDashboardStats } from "./service";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("dashboard stats test database not initialized");
      }
      return state.database;
    },
  };
});

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDaysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);

/** Insert one credit row with explicit timestamps (harness defaults are "now"). */
const insertCredit = async (values: {
  credits: number;
  createdAt: Date;
  expiresAt?: Date | null;
  id: string;
  remainingCredits?: number;
  status: string;
  transactionNo: string;
  transactionType: string;
  userId: string;
}) => {
  await db().run(sql`
    INSERT INTO credit (id, user_id, transaction_no, transaction_type, credits,
      remaining_credits, status, expires_at, created_at, updated_at)
    VALUES (${values.id}, ${values.userId}, ${values.transactionNo}, ${values.transactionType},
      ${values.credits}, ${values.remainingCredits ?? values.credits}, ${values.status},
      ${values.expiresAt ? values.expiresAt.getTime() : null},
      ${values.createdAt.getTime()}, ${values.createdAt.getTime()})
  `);
};

/** Insert one paid order with explicit createdAt. */
const insertOrder = async (values: {
  amount: number;
  createdAt: Date;
  currency: string;
  id: string;
  orderNo: string;
  status: string;
  userId: string;
}) => {
  await db().run(sql`
    INSERT INTO "order" (id, order_no, user_id, amount, currency, status,
      payment_provider, created_at, updated_at)
    VALUES (${values.id}, ${values.orderNo}, ${values.userId}, ${values.amount},
      ${values.currency}, ${values.status}, 'stripe',
      ${values.createdAt.getTime()}, ${values.createdAt.getTime()})
  `);
};

/** Insert one apikey row（字段对齐 `@better-auth/api-key` 的模型）。 */
const insertApiKey = async (values: {
  createdAt: Date;
  enabled?: boolean;
  expiresAt?: Date | null;
  id: string;
  userId: string;
}) => {
  // key/start 先在 JS 侧拼接——不要把参数嵌进 SQL 字符串字面量，绑定顺序会错位。
  const hashedKey = `hash-${values.id}`;
  await db().run(sql`
    INSERT INTO apikey (
      id, config_id, name, start, reference_id, key, enabled, rate_limit_enabled,
      rate_limit_max, rate_limit_time_window, request_count, expires_at, created_at, updated_at
    )
    VALUES (${values.id}, 'default', 'key', 'sk_abcd', ${values.userId}, ${hashedKey},
      ${values.enabled ?? true}, 1, 10, 86400000, 0,
      ${values.expiresAt ? values.expiresAt.getTime() : null},
      ${values.createdAt.getTime()}, ${values.createdAt.getTime()})
  `);
};

describe("getDashboardStats", () => {
  beforeAll(async () => {
    state.database = await createApiTestDatabase("dashboard-stats");
  });
  afterAll(() => {
    if (state.database) {
      closeApiTestDatabase(state.database);
    }
  });
  beforeEach(async () => {
    if (state.database) {
      await resetApiTestDatabase(state.database);
    }
  });

  it("returns zeroes for a user with no data", async () => {
    const userId = await insertUser(db(), { email: "empty@example.com", id: "user-empty" });

    const stats = await getDashboardStats(userId);

    expect(stats).toEqual({
      activeApiKeys: 0,
      creditsConsumed30d: 0,
      creditsGranted30d: 0,
      ordersCount: 0,
      paidOrdersCount: 0,
      spendTotal: null,
      trend: Array.from({ length: 30 }, (_, index) => ({
        consumed: 0,
        date: new Date(Date.now() - (29 - index) * DAY_MS).toISOString().slice(0, 10),
        granted: 0,
      })),
    });
  });

  it("sums grant/consume credits and paid spend over the last 30 days", async () => {
    const userId = await insertUser(db(), { email: "stats@example.com", id: "user-stats" });

    // Inside the 30-day window.
    await insertCredit({
      credits: 500,
      createdAt: isoDaysAgo(5),
      id: "c-grant-recent",
      status: "active",
      transactionNo: "txn-grant-recent",
      transactionType: "grant",
      userId,
    });
    await insertCredit({
      credits: -120,
      createdAt: isoDaysAgo(3),
      id: "c-consume-recent",
      remainingCredits: 0,
      status: "active",
      transactionNo: "txn-consume-recent",
      transactionType: "consume",
      userId,
    });
    // Outside the 30-day window (must not count).
    await insertCredit({
      credits: 9_999,
      createdAt: isoDaysAgo(45),
      id: "c-grant-old",
      status: "active",
      transactionNo: "txn-grant-old",
      transactionType: "grant",
      userId,
    });
    // Revoked consumption (status deleted — must not count).
    await insertCredit({
      credits: -50,
      createdAt: isoDaysAgo(2),
      id: "c-consume-deleted",
      remainingCredits: 0,
      status: "deleted",
      transactionNo: "txn-consume-deleted",
      transactionType: "consume",
      userId,
    });

    await insertOrder({
      amount: 2900,
      createdAt: isoDaysAgo(10),
      currency: "usd",
      id: "o-paid",
      orderNo: "no-paid",
      status: "paid",
      userId,
    });
    await insertOrder({
      amount: 990,
      createdAt: isoDaysAgo(1),
      currency: "usd",
      id: "o-pending",
      orderNo: "no-pending",
      status: "pending",
      userId,
    });

    const stats = await getDashboardStats(userId);

    expect(stats.creditsGranted30d).toBe(500);
    expect(stats.creditsConsumed30d).toBe(120);
    expect(stats.ordersCount).toBe(2);
    expect(stats.paidOrdersCount).toBe(1);
    // spendTotal is the latest currency's paid total (mixed-currency orders are not summed).
    expect(stats.spendTotal).toEqual({ currency: "USD", total: 2900 });
  });

  it("builds a 30-day trend bucketed by day with grant/consume sums", async () => {
    const userId = await insertUser(db(), { email: "trend@example.com", id: "user-trend" });

    await insertCredit({
      credits: 300,
      createdAt: isoDaysAgo(2),
      id: "c-trend-grant",
      status: "active",
      transactionNo: "txn-trend-grant",
      transactionType: "grant",
      userId,
    });
    await insertCredit({
      credits: -100,
      createdAt: isoDaysAgo(2),
      id: "c-trend-consume",
      remainingCredits: 0,
      status: "active",
      transactionNo: "txn-trend-consume",
      transactionType: "consume",
      userId,
    });

    const stats = await getDashboardStats(userId);

    expect(stats.trend).toHaveLength(30);
    // Oldest bucket first.
    expect(stats.trend[0]?.date.length).toBe(10);
    // 按日期键定位桶：避免「ISO 日期随运行时刻跨日」导致的固定下标脆弱性。
    const seededDateKey = isoDaysAgo(2).toISOString().slice(0, 10);
    const twoDaysAgo = stats.trend.find((point) => point.date === seededDateKey);
    expect(twoDaysAgo?.granted).toBe(300);
    expect(twoDaysAgo?.consumed).toBe(100);
    // Buckets without activity stay zero.
    expect(stats.trend.at(-1)?.granted).toBe(0);
    expect(stats.trend.at(-1)?.consumed).toBe(0);
  });

  it("scopes all aggregates to the requesting user", async () => {
    await insertUser(db(), { email: "mine@example.com", id: "user-mine" });
    const otherId = await insertUser(db(), { email: "other@example.com", id: "user-other" });

    await insertCredit({
      credits: 700,
      createdAt: isoDaysAgo(1),
      id: "c-other",
      status: "active",
      transactionNo: "txn-other",
      transactionType: "grant",
      userId: otherId,
    });
    await insertOrder({
      amount: 5_000,
      createdAt: isoDaysAgo(1),
      currency: "usd",
      id: "o-other",
      orderNo: "no-other",
      status: "paid",
      userId: otherId,
    });
    await insertApiKey({
      createdAt: isoDaysAgo(1),
      id: "k-other",
      userId: otherId,
    });

    const mine = await getDashboardStats("user-mine");
    const other = await getDashboardStats(otherId);

    expect(mine.creditsGranted30d).toBe(0);
    expect(mine.ordersCount).toBe(0);
    expect(mine.activeApiKeys).toBe(0);
    expect(other.creditsGranted30d).toBe(700);
    expect(other.ordersCount).toBe(1);
    expect(other.activeApiKeys).toBe(1);
  });

  it("counts enabled, non-expired API keys", async () => {
    const userId = await insertUser(db(), { email: "keys@example.com", id: "user-keys" });

    await insertApiKey({ createdAt: isoDaysAgo(3), id: "k-active", userId });
    await insertApiKey({ createdAt: isoDaysAgo(2), enabled: false, id: "k-revoked", userId });
    await insertApiKey({
      createdAt: isoDaysAgo(2),
      expiresAt: isoDaysAgo(1),
      id: "k-expired",
      userId,
    });

    const stats = await getDashboardStats(userId);

    expect(stats.activeApiKeys).toBe(1);
  });

  it("uses the most recent paid order currency when orders mix currencies", async () => {
    const userId = await insertUser(db(), { email: "mixed@example.com", id: "user-mixed" });

    await insertOrder({
      amount: 1_000,
      createdAt: isoDaysAgo(9),
      currency: "cny",
      id: "o-cny",
      orderNo: "no-cny",
      status: "paid",
      userId,
    });
    await insertOrder({
      amount: 500,
      createdAt: isoDaysAgo(2),
      currency: "usd",
      id: "o-usd",
      orderNo: "no-usd",
      status: "paid",
      userId,
    });

    const stats = await getDashboardStats(userId);

    expect(stats.spendTotal).toEqual({ currency: "USD", total: 500 });
  });
});
