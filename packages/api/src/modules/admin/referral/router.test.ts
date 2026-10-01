/**
 * Admin referral router tests — config/commissions/relations/rate management.
 *
 * Mirrors the harness pattern from referral/router.test.ts and admin/overview/router.test.ts:
 * - x-test-user-id requireAuth mock
 * - rbac passthrough
 * - temp SQLite + referral/commission/user DDL
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import type { Database } from "@openstarter/db";
import { createDb } from "@openstarter/db";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
  mockGrant: vi.fn(),
  savedConfig: { enabled: true, defaultRate: 1000, minSettleCredits: 100 },
}));

vi.mock("@openstarter/auth", () => ({
  rbac: {
    matcher: { matchPermission: (_code: string, _codes: string[]) => true },
    service: { getUserPermissionCodes: async () => ["admin.*"] },
  },
  server: {
    createAuth: () => ({
      api: {
        getSession: async (_headers: unknown) => ({ user: { id: "admin-user" } }),
      },
    }),
  },
  apikeys: {
    service: { validateApiKey: async () => null },
  },
}));

vi.mock("../../../middleware/auth", () => {
  const requireAuth = async (
    c: { set: (k: string, v: unknown) => void; req: { header: (h: string) => string | null } },
    next: () => Promise<void>,
  ) => {
    c.set("session", null);
    c.set("userId", c.req.header("x-test-user-id") ?? "admin-user");
    await next();
  };
  return { requireAuth };
});

vi.mock("../../../middleware/rbac", () => {
  const requirePermission =
    () =>
    async (
      _c: { set: (k: string, v: unknown) => void; req: { header: (h: string) => string | null } },
      next: () => Promise<void>,
    ) => {
      await next();
    };
  return { requirePermission };
});

vi.mock("@openstarter/db/server", () => {
  return {
    db: () => {
      if (!state.database) {
        throw new Error("admin referral test database not initialized");
      }
      return state.database;
    },
  };
});

vi.mock("@openstarter/billing-web", () => {
  return {
    grant: state.mockGrant,
    CommissionStatus: { PENDING: "pending", SETTLED: "settled", VOID: "void" },
    REFERRAL_SCENE: "referral",
    REFERRAL_CONFIG_KEY: "referral",
    referralConfigSchema: {
      parse: (data: unknown) => {
        const d = data as Record<string, unknown>;
        return {
          enabled: d.enabled ?? true,
          defaultRate: typeof d.defaultRate === "number" ? d.defaultRate : 1000,
          minSettleCredits: typeof d.minSettleCredits === "number" ? d.minSettleCredits : 100,
        };
      },
    },
    getReferralConfig: vi.fn(async () => state.savedConfig),
    resolveRate: (custom: number | null | undefined, def: number) => custom ?? def,
    calcCommissionCredits: (base: number, rate: number) => Math.round((base * rate) / 10000),
  };
});

import { Hono } from "hono";
import { referralAdminRouter } from "./router";

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

const CREATE_CONFIG_TABLE = `CREATE TABLE config (
  name TEXT PRIMARY KEY,
  value TEXT
)`;

const CREATE_CREDIT_TABLE = `CREATE TABLE credit (
  id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_scene TEXT,
  transaction_no TEXT NOT NULL UNIQUE,
  description TEXT,
  user_id TEXT NOT NULL REFERENCES user(id),
  user_email TEXT,
  order_no TEXT,
  subscription_no TEXT,
  expires_at INTEGER,
  consumed_detail TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  deleted_at INTEGER
)`;

let dbPath: string | undefined;

beforeAll(async () => {
  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { join } = await import("node:path");
  dbPath = join(tmpDir, `admin-referral-test-${Date.now()}.db`);

  const database = createDb({
    provider: "sqlite",
    url: `file://${dbPath}`,
    singleton: false,
  });

  await database.run(sql.raw(CREATE_USER_TABLE));
  await database.run(sql.raw(CREATE_REFERRAL_TABLE));
  await database.run(sql.raw(CREATE_RELATION_TABLE));
  await database.run(sql.raw(CREATE_COMMISSION_TABLE));
  await database.run(sql.raw(CREATE_CONFIG_TABLE));
  await database.run(sql.raw(CREATE_CREDIT_TABLE));

  state.database = database;
});

afterAll(() => {
  if (dbPath) {
    import("node:fs").then((fs) => fs.rmSync(dbPath!, { force: true }));
  }
  state.database = undefined;
});

beforeEach(async () => {
  state.mockGrant.mockClear();
  if (state.database) {
    const drizzleSql = (await import("drizzle-orm")).sql;
    await state.database.run(drizzleSql.raw("DELETE FROM credit"));
    await state.database.run(drizzleSql.raw("DELETE FROM config"));
    await state.database.run(drizzleSql.raw("DELETE FROM commission"));
    await state.database.run(drizzleSql.raw("DELETE FROM referral_relation"));
    await state.database.run(drizzleSql.raw("DELETE FROM referral"));
    await state.database.run(drizzleSql.raw("DELETE FROM user"));
  }
});

const app = new Hono().route("/", referralAdminRouter);

function request(path: string, init: RequestInit = {}) {
  return app.request(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "content-type": "application/json",
      "x-test-user-id": "admin-user",
    },
  });
}

async function insertTestUser(userId: string, email: string) {
  await state.database!.run(
    sql`INSERT INTO user (id, name, email, email_verified) VALUES (${userId}, ${"Test"}, ${email}, 1)`,
  );
}

describe("admin referral", () => {
  it("PUT config defaultRate=6000 → 400 (上限 5000)", async () => {
    const res = await request("/config", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, defaultRate: 6000, minSettleCredits: 100 }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT config valid → 200", async () => {
    const res = await request("/config", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, defaultRate: 1500, minSettleCredits: 100 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: number };
    expect(body.code).toBe(0);
    // 更新 savedConfig 以便 GET 回读
    state.savedConfig = { enabled: true, defaultRate: 1500, minSettleCredits: 100 };
  });

  it("GET config → 返回当前配置", async () => {
    const res = await request("/config");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      code: number;
      data: { enabled: boolean; defaultRate: number; minSettleCredits: number };
    };
    expect(body.code).toBe(0);
    expect(body.data.enabled).toBe(true);
    expect(body.data.defaultRate).toBe(state.savedConfig.defaultRate);
    expect(body.data.minSettleCredits).toBe(state.savedConfig.minSettleCredits);
  });

  it("settle pending → 发分 + 状态 settled + transactionNo 回填", async () => {
    await insertTestUser("user-a", "referrer@example.com");
    await insertTestUser("user-b", "referred@example.com");

    // Insert pending commission
    const commissionId = "comm-1";
    await state.database!.run(
      sql`INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status)
           VALUES (${commissionId}, 'order-1', 'user-a', 'user-b', 10000, 'usd', 1000, 100, 'pending')`,
    );

    const mockGrantResult = {
      id: "credit-1",
      credits: 100,
      remainingCredits: 100,
      status: "active",
      transactionNo: "tx-1",
      transactionScene: "referral",
      transactionType: "grant",
      userId: "user-a",
      userEmail: "",
      description: "Referral commission for order order-1",
      orderNo: "order-1",
      subscriptionNo: "",
      expiresAt: null,
    };

    state.mockGrant.mockResolvedValueOnce(mockGrantResult as never);

    const res = await request(`/commissions/${commissionId}/settle`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: number; data: { transactionNo: string } };
    expect(body.code).toBe(0);
    expect(body.data.transactionNo).toBe("tx-1");

    // Verify commission status changed to settled
    const rows = (await state.database!.all(
      sql`SELECT status, transaction_no, settled_by FROM commission WHERE id = ${commissionId}`,
    )) as Array<
      { status: string; transaction_no: string; settled_by: string } & { [key: string]: unknown }
    >;
    const row = rows[0];
    if (!row) throw new Error("commission row not found");
    expect(row.status).toBe("settled");
    expect(row.transaction_no).toBe("tx-1");
    expect(row.settled_by).toBe("admin-user");
  });

  it("settle 二次点击（已 settled）→ 409 幂等", async () => {
    await insertTestUser("user-a", "referrer2@example.com");
    await insertTestUser("user-b", "referred2@example.com");

    const commissionId = "comm-2";
    await state.database!.run(
      sql`INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status, settled_at, settled_by, transaction_no)
           VALUES (${commissionId}, 'order-2', 'user-a', 'user-b', 10000, 'usd', 1000, 100, 'settled', 1700000000, 'admin-user', 'tx-existing')`,
    );

    const res = await request(`/commissions/${commissionId}/settle`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: number; message: string };
    expect(body.code).toBe(-1);
    expect(body.message).toBe("NOT_PENDING");

    // grant should NOT be called again (幂等)
    expect(state.mockGrant).not.toHaveBeenCalled();
  });

  it("void pending → status=void 且不发分", async () => {
    await insertTestUser("user-a", "referrer3@example.com");
    await insertTestUser("user-b", "referred3@example.com");

    const commissionId = "comm-3";
    await state.database!.run(
      sql`INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status)
           VALUES (${commissionId}, 'order-3', 'user-a', 'user-b', 10000, 'usd', 1000, 100, 'pending')`,
    );

    const res = await request(`/commissions/${commissionId}/void`, { method: "POST" });
    expect(res.status).toBe(200);
    const voidBody = (await res.json()) as { code: number };
    expect(voidBody.code).toBe(0);

    // Verify status changed to void
    const voidRows = (await state.database!.all(
      sql`SELECT status FROM commission WHERE id = ${commissionId}`,
    )) as Array<{ status: string } & { [key: string]: unknown }>;
    const voidRow = voidRows[0];
    if (!voidRow) throw new Error("commission row not found");
    expect(voidRow.status).toBe("void");

    // Verify no credit records for referral scene
    const credits = (await state.database!.all(
      sql`SELECT * FROM credit WHERE transaction_scene = 'referral'`,
    )) as Array<Record<string, unknown>>;
    expect(credits.length).toBe(0);
  });

  it("PUT rate: 设 3000 / 清 null", async () => {
    await insertTestUser("user-1", "rate-user@example.com");

    // 先建 referral 行
    const referralId = "ref-1";
    await state.database!.run(
      sql`INSERT INTO referral (id, user_id, code) VALUES (${referralId}, 'user-1', 'RATE0001')`,
    );

    // 设 customRate = 3000
    const setRes = await request("/users/user-1/rate", {
      method: "PUT",
      body: JSON.stringify({ customRate: 3000 }),
    });
    expect(setRes.status).toBe(200);

    // 回读
    const rows1 = (await state.database!.all(
      sql`SELECT custom_rate FROM referral WHERE user_id = 'user-1'`,
    )) as Array<{ custom_rate: number | null } & { [key: string]: unknown }>;
    const row1 = rows1[0];
    if (!row1) throw new Error("referral row not found");
    expect(row1.custom_rate).toBe(3000);

    // 清 null
    const clearRes = await request("/users/user-1/rate", {
      method: "PUT",
      body: JSON.stringify({ customRate: null }),
    });
    expect(clearRes.status).toBe(200);

    const rows2 = (await state.database!.all(
      sql`SELECT custom_rate FROM referral WHERE user_id = 'user-1'`,
    )) as Array<{ custom_rate: number | null } & { [key: string]: unknown }>;
    const row2 = rows2[0];
    if (!row2) throw new Error("referral row not found");
    expect(row2.custom_rate).toBeNull();
  });

  it("手动补记：同 orderNo 已存在 → 幂等不重复", async () => {
    await insertTestUser("user-a", "manual-ref@example.com");
    await insertTestUser("user-b", "manual-referee@example.com");

    const createBody = {
      orderNo: "order-manual-1",
      referrerId: "user-a",
      referredUserId: "user-b",
      baseAmount: 50000,
      rate: 1500,
    };

    const res1 = await request("/commissions", {
      method: "POST",
      body: JSON.stringify(createBody),
    });
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { code: number; data: { id: string } };
    expect(body1.code).toBe(0);

    // 第二次发同样的 orderNo → 幂等
    const res2 = await request("/commissions", {
      method: "POST",
      body: JSON.stringify(createBody),
    });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { code: number; data: { id: string } };
    expect(body2.code).toBe(0);
    // 返回同一行
    expect(body2.data.id).toBe(body1.data.id);

    // 确认 commission 表只有 1 条
    const countRows = (await state.database!.all(
      sql`SELECT COUNT(*) as cnt FROM commission WHERE order_no = 'order-manual-1'`,
    )) as Array<{ cnt: number } & { [key: string]: unknown }>;
    const countRow = countRows[0];
    if (!countRow) throw new Error("count row not found");
    expect(Number(countRow.cnt)).toBe(1);
  });

  it("listCommissions with status filter + pagination", async () => {
    await insertTestUser("user-a", "list-ref@example.com");
    await insertTestUser("user-b", "list-referee@example.com");

    await state.database!.run(
      sql`INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status)
           VALUES ('c1', 'order-l1', 'user-a', 'user-b', 100, 'usd', 1000, 10, 'pending')`,
    );
    await state.database!.run(
      sql`INSERT INTO commission (id, order_no, referrer_id, referred_user_id, base_amount, base_currency, rate, commission_credits, status)
           VALUES ('c2', 'order-l2', 'user-a', 'user-b', 200, 'usd', 1000, 20, 'settled')`,
    );

    const res = await request("/commissions?page=1&pageSize=10&status=pending");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: number; data: { items: unknown[]; total: number } };
    expect(body.code).toBe(0);
    expect(body.data.total).toBe(1);
    expect(body.data.items.length).toBe(1);
  });

  it("listRelations with pagination", async () => {
    await insertTestUser("user-a", "rel-ref@example.com");
    await insertTestUser("user-b", "rel-referee@example.com");
    await insertTestUser("user-c", "rel-referee2@example.com");

    await state.database!.run(
      sql`INSERT INTO referral_relation (id, referrer_id, referred_user_id, code) VALUES ('r1', 'user-a', 'user-b', 'CODE1')`,
    );
    await state.database!.run(
      sql`INSERT INTO referral_relation (id, referrer_id, referred_user_id, code) VALUES ('r2', 'user-a', 'user-c', 'CODE1')`,
    );

    const res = await request("/relations?page=1&pageSize=10");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: number; data: { items: unknown[]; total: number } };
    expect(body.code).toBe(0);
    expect(body.data.total).toBe(2);
    expect(body.data.items.length).toBe(2);
  });
});
