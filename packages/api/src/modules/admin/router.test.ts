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

vi.mock("./analytics/router", () => ({ analyticsRouter: new Hono() }));
vi.mock("./overview/router", () => ({ overviewRouter: new Hono() }));
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
