// Referral router composition tests — 挂载完整性回归。
//
// 验证 referralRouter 的四个端点通过完整组合根可达，
// 以及 bind 的错误码路由（404/409/422）。

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import type { Database } from "@openstarter/db";
import { createDb } from "@openstarter/db";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("referral router test database not initialized");
      }
      return state.database;
    },
  };
});

vi.mock("../../middleware/auth", async () => {
  const { createMiddleware } = await import("hono/factory");
  const requireAuth = createMiddleware<{
    Variables: { userId: string; session: null };
  }>(async (c, next) => {
    c.set("session", null);
    c.set("userId", c.req.header("x-test-user-id") ?? "test-user");
    await next();
  });
  return { requireAuth };
});

vi.mock("../../middleware/plan-gate", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware(async (_c, next) => {
    await next();
  });
  return { requirePlan: () => passthrough };
});

vi.mock("../../middleware/rbac", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware(async (_c, next) => {
    await next();
  });
  return { requirePermission: () => passthrough };
});

import { Hono } from "hono";
import { referralRouter } from "./router";

const NOW_MS = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

const CREATE_USER_TABLE = `CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  utm_source TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT '',
  ban_expires INTEGER,
  banned INTEGER NOT NULL DEFAULT 0,
  ban_reason TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0
)`;

const CREATE_REFERRAL_TABLE = `CREATE TABLE referral (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES user(id),
  code TEXT NOT NULL UNIQUE,
  custom_rate INTEGER,
  note TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

const CREATE_RELATION_TABLE = `CREATE TABLE referral_relation (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES user(id),
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES user(id),
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

const CREATE_COMMISSION_TABLE = `CREATE TABLE commission (
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
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

let dbPath: string | undefined;

beforeAll(async () => {
  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { join } = await import("node:path");
  dbPath = join(tmpDir, `referral-router-test-${Date.now()}.db`);

  const database = createDb({
    provider: "sqlite",
    url: `file://${dbPath}`,
    singleton: false,
  });

  await database.run(sql.raw(CREATE_USER_TABLE));
  await database.run(sql.raw(CREATE_REFERRAL_TABLE));
  await database.run(sql.raw(CREATE_RELATION_TABLE));
  await database.run(sql.raw(CREATE_COMMISSION_TABLE));

  state.database = database;
});

afterAll(() => {
  if (dbPath) {
    import("node:fs").then((fs) => fs.rmSync(dbPath!, { force: true }));
  }
  state.database = undefined;
});

beforeEach(async () => {
  if (state.database) {
    const sql = (await import("drizzle-orm")).sql;
    await state.database.run(sql.raw("DELETE FROM referral_relation"));
    await state.database.run(sql.raw("DELETE FROM commission"));
    await state.database.run(sql.raw("DELETE FROM referral"));
    await state.database.run(sql.raw("DELETE FROM user"));
  }
});

const app = new Hono().route("/", referralRouter);

function request(path: string, init: RequestInit = {}) {
  const userId = (init.headers as Record<string, string>)?.["x-test-user-id"] ?? "user-1";
  return app.request(path, {
    ...init,
    headers: {
      ...((init.headers as Record<string, string>) ?? {}),
      "content-type": "application/json",
      "x-test-user-id": userId,
    },
  });
}

async function insertTestUser(userId: string, email: string) {
  await state.database!.run(
    sql`INSERT INTO user (id, name, email, email_verified) VALUES (${userId}, ${"Test"}, ${email}, 1)`,
  );
}

describe("referral router composition (mount regression)", () => {
  it("GET /referral/me returns code, link, and stats envelope", async () => {
    await insertTestUser("user-1", "referral-me@example.com");

    const response = await request("/referral/me");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      code: number;
      data: { code: string; link: string; stats: object };
    };
    expect(body.code).toBe(0);
    expect(body.data.code).toBeDefined();
    expect(body.data.link).toContain("register?ref=");
    expect(body.data.stats).toEqual({
      referredCount: 0,
      pendingCredits: 0,
      settledCredits: 0,
      totalCredits: 0,
    });
  });

  it("GET /referral/commissions returns paginated items", async () => {
    await insertTestUser("user-1", "commissions@example.com");

    const response = await request("/referral/commissions?page=1&pageSize=20");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      code: number;
      data: { items: unknown[]; total: number };
    };
    expect(body.code).toBe(0);
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it("GET /referral/relations returns paginated items", async () => {
    await insertTestUser("user-1", "relations@example.com");

    const response = await request("/referral/relations?page=1&pageSize=20");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      code: number;
      data: { items: unknown[]; total: number };
    };
    expect(body.code).toBe(0);
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it("POST /referral/bind with valid code → 200", async () => {
    await insertTestUser("user-1", "ref@example.com");
    await insertTestUser("user-2", "referee@example.com");

    // Pre-create referral code for user-1
    const db = state.database!;
    await db.run(
      sql`INSERT INTO referral (id, user_id, code) VALUES ('ref-1', 'user-1', 'CODE1234')`,
    );

    const response = await request("/referral/bind", {
      method: "POST",
      body: JSON.stringify({ code: "CODE1234" }),
      headers: { "x-test-user-id": "user-2" },
    });
    expect(response.status).toBe(200);
  });

  it("POST /referral/bind with invalid code → 404", async () => {
    await insertTestUser("user-1", "bind@example.com");

    const response = await request("/referral/bind", {
      method: "POST",
      body: JSON.stringify({ code: "NONEXIST" }),
    });
    expect(response.status).toBe(404);
  });

  it("POST /referral/bind with already-referred user → 409", async () => {
    await insertTestUser("user-1", "ref@example.com");
    await insertTestUser("user-2", "referee@example.com");

    const db = state.database!;
    await db.run(
      sql`INSERT INTO referral (id, user_id, code) VALUES ('ref-1', 'user-1', 'CODE1234')`,
    );
    // Pre-create relation for user-2
    await db.run(
      sql`INSERT INTO referral_relation (id, referrer_id, referred_user_id, code) VALUES ('rel-1', 'user-1', 'user-2', 'CODE1234')`,
    );

    const response = await request("/referral/bind", {
      method: "POST",
      body: JSON.stringify({ code: "CODE1234" }),
      headers: { "x-test-user-id": "user-2" },
    });
    expect(response.status).toBe(409);
  });
});
