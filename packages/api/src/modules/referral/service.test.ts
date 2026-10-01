// Referral service tests: bindReferral validation matrix + lazy generation + stats,
// using the shared api-test-database harness with referral tables created in setUp.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@openstarter/db";
import { db } from "@openstarter/db/server";
import {
  closeApiTestDatabase,
  createApiTestDatabase,
  insertUser,
  resetApiTestDatabase,
} from "../../test/api-test-database";
import {
  BindReferralError,
  bindReferral,
  getMyReferralStats,
  getOrCreateReferralCode,
  listMyCommissions,
  listMyRelations,
} from "./service";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("referral service test database not initialized");
      }
      return state.database;
    },
  };
});

const NOW_EXPR = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

const CREATE_REFERRAL_TABLES = [
  `CREATE TABLE referral (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES user(id),
    code TEXT NOT NULL UNIQUE,
    custom_rate INTEGER,
    note TEXT DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR}
  )`,
  `CREATE TABLE referral_relation (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL REFERENCES user(id),
    referred_user_id TEXT NOT NULL UNIQUE REFERENCES user(id),
    code TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR}
  )`,
  `CREATE TABLE commission (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    referrer_id TEXT NOT NULL REFERENCES user(id),
    referred_user_id TEXT NOT NULL REFERENCES user(id),
    base_amount INTEGER NOT NULL,
    base_currency TEXT,
    rate INTEGER NOT NULL,
    commission_credits INTEGER NOT NULL,
    cash_amount INTEGER,
    status TEXT NOT NULL,
    settled_at INTEGER,
    settled_by TEXT,
    transaction_no TEXT,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR}
  )`,
];

beforeAll(async () => {
  state.database = await createApiTestDatabase("referral-service");
  const sql = (await import("drizzle-orm")).sql;
  for (const stmt of CREATE_REFERRAL_TABLES) {
    await state.database.run(sql.raw(stmt));
  }
});

afterAll(() => {
  if (state.database) {
    closeApiTestDatabase(state.database);
  }
  state.database = undefined;
});

beforeEach(async () => {
  if (state.database) {
    // Clear referral child tables first (they reference user), before resetApiTestDatabase deletes users
    const sql = (await import("drizzle-orm")).sql;
    await state.database.run(sql.raw("DELETE FROM referral_relation"));
    await state.database.run(sql.raw("DELETE FROM commission"));
    await state.database.run(sql.raw("DELETE FROM referral"));
    await resetApiTestDatabase(state.database);
  }
});

describe("bindReferral", () => {
  it("valid code + new user → creates relation", async () => {
    await insertUser(db(), { email: "referrer@example.com", id: "userA" });
    await insertUser(db(), { email: "referred@example.com", id: "userB" });

    // Create referral code for userA
    const code = await getOrCreateReferralCode("userA");

    const res = await bindReferral({ code, userId: "userB" });
    expect(res.ok).toBe(true);
  });

  it("code does not exist → INVALID_CODE", async () => {
    await insertUser(db(), { email: "referred@example.com", id: "userB" });

    const res = await bindReferral({ code: "nope", userId: "userB" });
    expect(res.error).toBe(BindReferralError.INVALID_CODE);
    expect(res.ok).toBe(false);
  });

  it("self referral → SELF_REFERRAL", async () => {
    await insertUser(db(), { email: "self@example.com", id: "userA" });
    const code = await getOrCreateReferralCode("userA");

    const res = await bindReferral({ code, userId: "userA" });
    expect(res.error).toBe(BindReferralError.SELF_REFERRAL);
    expect(res.ok).toBe(false);
  });

  it("user already has a referrer → ALREADY_REFERRED", async () => {
    await insertUser(db(), { email: "refA@example.com", id: "userA" });
    await insertUser(db(), { email: "refB@example.com", id: "userC" });
    await insertUser(db(), { email: "referred@example.com", id: "userB" });

    const codeA = await getOrCreateReferralCode("userA");
    const codeC = await getOrCreateReferralCode("userC");

    // Bind userB to userA first
    const firstRes = await bindReferral({ code: codeA, userId: "userB" });
    expect(firstRes.ok).toBe(true);

    // Try to bind userB to userC
    const secondRes = await bindReferral({ code: codeC, userId: "userB" });
    expect(secondRes.error).toBe(BindReferralError.ALREADY_REFERRED);
    expect(secondRes.ok).toBe(false);
  });

  it("referrer already has a referrer (second level) → NO_SECOND_LEVEL", async () => {
    await insertUser(db(), { email: "refA@example.com", id: "userA" });
    await insertUser(db(), { email: "refB@example.com", id: "userB" });
    await insertUser(db(), { email: "referred@example.com", id: "userD" });

    // userA's code refers userB
    const codeA = await getOrCreateReferralCode("userA");
    await bindReferral({ code: codeA, userId: "userB" });

    // userB's code tries to refer userD → should fail
    const codeB = await getOrCreateReferralCode("userB");
    const res = await bindReferral({ code: codeB, userId: "userD" });
    expect(res.error).toBe(BindReferralError.NO_SECOND_LEVEL);
    expect(res.ok).toBe(false);
  });
});

describe("getOrCreateReferralCode", () => {
  it("first call generates 8-char code and is idempotent", async () => {
    await insertUser(db(), { email: "codeTest@example.com", id: "userA" });

    const c1 = await getOrCreateReferralCode("userA");
    const c2 = await getOrCreateReferralCode("userA");

    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });
});

describe("getMyReferralStats", () => {
  it("returns zeros for user with no referrals or commissions", async () => {
    await insertUser(db(), { email: "empty@example.com", id: "userA" });

    const stats = await getMyReferralStats("userA");

    expect(stats.referredCount).toBe(0);
    expect(stats.pendingCredits).toBe(0);
    expect(stats.settledCredits).toBe(0);
    expect(stats.totalCredits).toBe(0);
  });

  it("aggregates referrals and commission credits correctly", async () => {
    await insertUser(db(), { email: "ref@example.com", id: "userA" });
    await insertUser(db(), { email: "ref1@example.com", id: "userB" });
    await insertUser(db(), { email: "ref2@example.com", id: "userC" });

    // Create referral relations
    const codeA = await getOrCreateReferralCode("userA");
    await bindReferral({ code: codeA, userId: "userB" });
    await bindReferral({ code: codeA, userId: "userC" });

    // Insert a pending commission
    const sql = (await import("drizzle-orm")).sql;
    await db().run(sql`
      INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status)
      VALUES ('comm-1', 'order-1', 'userA', 'userB', 1000, 'USD', 1000, 100, 'pending')
    `);
    // Insert a settled commission
    await db().run(sql`
      INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status)
      VALUES ('comm-2', 'order-2', 'userA', 'userC', 2000, 'USD', 1000, 200, 'settled')
    `);

    const stats = await getMyReferralStats("userA");

    expect(stats.referredCount).toBe(2);
    expect(stats.pendingCredits).toBe(100);
    expect(stats.settledCredits).toBe(200);
    expect(stats.totalCredits).toBe(300);
  });
});

describe("listMyCommissions", () => {
  it("returns paginated commissions for referrer", async () => {
    await insertUser(db(), { email: "ref@example.com", id: "userA" });
    await insertUser(db(), { email: "ref1@example.com", id: "userB" });

    const sql = (await import("drizzle-orm")).sql;
    for (let i = 0; i < 5; i++) {
      await db().run(sql`
        INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status)
        VALUES (${`comm-${i}`}, ${`order-${i}`}, 'userA', 'userB', 1000, 'USD', 1000, 100, 'pending')
      `);
    }

    const result = await listMyCommissions({ page: 1, pageSize: 3, userId: "userA" });

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(5);
  });
});

describe("listMyRelations", () => {
  it("returns paginated referral relations", async () => {
    await insertUser(db(), { email: "ref@example.com.com", id: "userA" });
    const code = await getOrCreateReferralCode("userA");

    for (let i = 0; i < 5; i++) {
      await insertUser(db(), { email: `r${i}@example.com`, id: `user-r${i}` });
      await bindReferral({ code, userId: `user-r${i}` });
    }

    const result = await listMyRelations({ page: 2, pageSize: 2, userId: "userA" });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
  });
});
