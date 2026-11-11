/**
 * Admin router composition tests — 挂载完整性回归（Task 10 review HIGH-1）。
 *
 * 背景：Task 4 曾把前台门面 `aiModelsRouter`（仅 GET）以别名误挂到 /admin/ai-models，
 * admin CRUD 子路由不可达。子路由测试直连 `adminAiModelsRouter` 发请求，绕过了聚合器，
 * 故未能捕获。本文件专门针对**组合根挂载**：经完整 `adminRouter` 断言
 * `/admin/ai-models` 上 POST/PATCH/DELETE 可达 CRUD 处理器（非 404、信封语义正确）。
 * CRUD 自身语义由 ai/catalog/router.test.ts 覆盖，此处不重复。
 *
 * 沿用 ai/catalog/router.test.ts 的 harness：x-test-user-id requireAuth mock、
 * plan-gate/rbac 透传、临时 SQLite + ai_model DDL。
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";
import type { Database } from "@openstarter/db";
import { createSqliteTestDb } from "@openstarter/db/testing";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("admin router test database not initialized");
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

// analytics/overview/tickets/rbac 子路由在本文件的作用域外（各自有守卫与依赖）；
// 挂载断言只针对 ai-models 组合缝，其余子路由 mock 为空路由避免拉入无关依赖。
vi.mock("./analytics/router", () => ({ analyticsRouter: new Hono() }));
vi.mock("./overview/router", () => ({ overviewRouter: new Hono() }));
vi.mock("./rbac/router", () => ({ rbacRouter: new Hono() }));
vi.mock("./tickets/router", () => ({ adminTicketsRouter: new Hono() }));

import { adminRouter } from "./router";

const NOW_MS = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

const CREATE_AI_MODEL = `CREATE TABLE ai_model (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  credit_price INTEGER NOT NULL DEFAULT 0,
  max_output_tokens INTEGER,
  options_schema TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

const CREATE_AI_MODEL_INDEXES: readonly string[] = [
  "CREATE INDEX idx_ai_model_enabled_media ON ai_model (enabled, media_type, sort_order)",
  "CREATE UNIQUE INDEX uq_ai_model_provider_model ON ai_model (provider, model_id)",
];

let dbPath: string | undefined;

beforeAll(async () => {
  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { join } = await import("node:path");
  dbPath = join(tmpDir, `admin-router-test-${Date.now()}.db`);

  const database = createSqliteTestDb(`file://${dbPath}`);

  await database.run(sql.raw(CREATE_AI_MODEL));
  for (const statement of CREATE_AI_MODEL_INDEXES) {
    await database.run(sql.raw(statement));
  }

  state.database = database;
});

afterAll(() => {
  if (dbPath) {
    import("node:fs").then((fs) => fs.rmSync(dbPath!, { force: true }));
  }
  state.database = undefined;
});

// 完整组合根：adminRouter 经 /admin 前缀挂载（与 packages/api/src/index.ts 一致）。
const app = new Hono().route("/admin", adminRouter);

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

describe("admin router composition (mount regression)", () => {
  it("POST /admin/ai-models reaches the CRUD handler through the composed router", async () => {
    const response = await request("/admin/ai-models", {
      body: JSON.stringify({
        provider: "openai",
        modelId: "mount-gpt",
        displayName: "Mount GPT",
        mediaType: "text",
      }),
      method: "POST",
    });

    // 门面误挂时此处为 404（门面仅注册 GET）；CRUD 可达时为 200 信封。
    expect(response.status).toBe(200);
    const body = (await response.json()) as { code: number; data: { modelId: string } };
    expect(body.code).toBe(0);
    expect(body.data.modelId).toBe("mount-gpt");
  });

  it("PATCH and DELETE /admin/ai-models/:id are mounted (non-404) through the composed router", async () => {
    const listResponse = await request("/admin/ai-models?page=1&pageSize=20");
    expect(listResponse.status).toBe(200);
    const list = (await listResponse.json()) as {
      data: { items: Array<{ id: string; modelId: string }> };
    };
    const created = list.data.items.find((item) => item.modelId === "mount-gpt");
    expect(created).toBeTruthy();
    const id = created!.id;

    const patchResponse = await request(`/admin/ai-models/${id}`, {
      body: JSON.stringify({ enabled: false }),
      method: "PATCH",
    });
    expect(patchResponse.status).toBe(200);

    const deleteResponse = await request(`/admin/ai-models/${id}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(200);
    const deleted = (await deleteResponse.json()) as { code: number };
    expect(deleted.code).toBe(0);
  });
});
