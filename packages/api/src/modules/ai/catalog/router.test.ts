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
        throw new Error("ai-catalog router test database not initialized");
      }
      return state.database;
    },
  };
});

vi.mock("../llm/provider", () => ({
  getAvailableProviders: () => Promise.resolve(["openai"]),
}));

vi.mock("../media/manager", () => ({
  getAIManager: () => Promise.resolve({ getProviderNames: () => ["replicate"] }),
}));

vi.mock("../../../middleware/auth", async () => {
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

vi.mock("../../../middleware/plan-gate", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware(async (_c, next) => {
    await next();
  });
  return { requirePlan: () => passthrough };
});

vi.mock("../../../middleware/rbac", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware(async (_c, next) => {
    await next();
  });
  return { requirePermission: () => passthrough };
});

import { adminAiModelsRouter, aiModelsRouter } from "./router";
import { createModel } from "./service";

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
  dbPath = join(tmpDir, `ai-catalog-router-test-${Date.now()}.db`);

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

function facadeRequest(path: string, init: RequestInit = {}) {
  return aiModelsRouter.request(path, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-test-user-id": "facade-user" },
  });
}

function adminRequest(path: string, init: RequestInit = {}) {
  return adminAiModelsRouter.request(path, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-test-user-id": "admin-user" },
  });
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  };
}

describe("GET /ai/models facade", () => {
  it("returns the five-key grouped envelope with enabled + available models only", async () => {
    await createModel({
      provider: "openai",
      modelId: "facade-gpt",
      displayName: "Facade GPT",
      mediaType: "text",
      creditPrice: 1,
    });
    await createModel({
      provider: "replicate",
      modelId: "facade-flux",
      displayName: "Facade FLUX",
      mediaType: "image",
      creditPrice: 5,
    });
    await createModel({
      provider: "openai",
      modelId: "facade-disabled",
      displayName: "Facade Disabled",
      mediaType: "text",
      creditPrice: 2,
      enabled: false,
    });
    await createModel({
      provider: "fal",
      modelId: "facade-seedance",
      displayName: "Facade Seedance",
      mediaType: "video",
      creditPrice: 20,
    });

    const response = await facadeRequest("/ai/models");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      code: number;
      message: string;
      data: Record<string, Array<{ provider: string; modelId: string }>>;
    };

    expect(body.code).toBe(0);
    expect(body.message).toBe("ok");
    expect(Object.keys(body.data).sort()).toEqual(["image", "music", "speech", "text", "video"]);
    expect(body.data.text?.some((m) => m.modelId === "facade-gpt")).toBe(true);
    expect(body.data.text?.every((m) => m.modelId !== "facade-disabled")).toBe(true);
    expect(body.data.image?.some((m) => m.modelId === "facade-flux")).toBe(true);
    expect(body.data.video).toEqual([]);
    expect(body.data.speech).toEqual([]);
  });
});

describe("admin AI model CRUD", () => {
  it("POST /ai-models creates a model and applies body defaults", async () => {
    const response = await adminRequest(
      "/",
      jsonInit("POST", {
        provider: "openai",
        modelId: "admin-gpt",
        displayName: "Admin GPT",
        mediaType: "text",
        creditPrice: 3,
      }),
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      code: number;
      message: string;
      data: Record<string, unknown>;
    };
    expect(body.code).toBe(0);
    expect(body.message).toBe("ok");
    expect(body.data.provider).toBe("openai");
    expect(body.data.modelId).toBe("admin-gpt");
    expect(body.data.creditPrice).toBe(3);
    expect(body.data.enabled).toBe(true);
    expect(body.data.sortOrder).toBe(0);
    expect(body.data.id).toBeTruthy();
  });

  it("POST /ai-models translates duplicate provider+modelId into a 409 error envelope", async () => {
    const response = await adminRequest(
      "/",
      jsonInit("POST", {
        provider: "openai",
        modelId: "admin-gpt",
        displayName: "Admin GPT duplicate",
        mediaType: "text",
        creditPrice: 3,
      }),
    );
    expect(response.status).toBe(409);

    const body = (await response.json()) as { code: number; message: string };
    expect(body.code).toBe(-1);
    expect(body.message).toBe("AI model with this provider and modelId already exists");
  });

  it("GET /ai-models lists with pagination and mediaType filtering", async () => {
    await createModel({
      provider: "elevenlabs",
      modelId: "admin-voice-1",
      displayName: "Admin Voice 1",
      mediaType: "speech",
      creditPrice: 2,
    });
    await createModel({
      provider: "elevenlabs",
      modelId: "admin-voice-2",
      displayName: "Admin Voice 2",
      mediaType: "speech",
      creditPrice: 4,
    });

    const filtered = await adminRequest("/?mediaType=speech");
    expect(filtered.status).toBe(200);
    const filteredBody = (await filtered.json()) as {
      code: number;
      data: { items: Array<{ mediaType: string }>; total: number };
    };
    expect(filteredBody.code).toBe(0);
    expect(filteredBody.data.total).toBe(2);
    expect(filteredBody.data.items).toHaveLength(2);
    expect(filteredBody.data.items.every((m) => m.mediaType === "speech")).toBe(true);

    const paged = await adminRequest("/?mediaType=speech&page=2&pageSize=1");
    expect(paged.status).toBe(200);
    const pagedBody = (await paged.json()) as {
      code: number;
      data: { items: Array<{ modelId: string }>; total: number };
    };
    expect(pagedBody.data.total).toBe(2);
    expect(pagedBody.data.items).toHaveLength(1);
    expect(["admin-voice-1", "admin-voice-2"]).toContain(pagedBody.data.items[0]?.modelId);
  });

  it("returns 400 for invalid mediaType on query and body", async () => {
    const badQuery = await adminRequest("/?mediaType=banana");
    expect(badQuery.status).toBe(400);

    const badBody = await adminRequest(
      "/",
      jsonInit("POST", {
        provider: "openai",
        modelId: "admin-bad-type",
        displayName: "Bad Type",
        mediaType: "banana",
      }),
    );
    expect(badBody.status).toBe(400);
  });

  it("PATCH /ai-models/:id updates only the submitted fields and returns the full record", async () => {
    const created = await createModel({
      provider: "openai",
      modelId: "admin-patch-target",
      displayName: "Patch Target",
      mediaType: "text",
      creditPrice: 7,
    });

    const response = await adminRequest(
      `/${created.id}`,
      jsonInit("PATCH", { enabled: false, displayName: "Patched Target" }),
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      code: number;
      data: { enabled: boolean; displayName: string; creditPrice: number };
    };
    expect(body.code).toBe(0);
    expect(body.data.enabled).toBe(false);
    expect(body.data.displayName).toBe("Patched Target");
    expect(body.data.creditPrice).toBe(7);
  });

  it("PATCH /ai-models/:id returns a 404 envelope for a missing model", async () => {
    const response = await adminRequest("/missing-id", jsonInit("PATCH", { enabled: true }));
    expect(response.status).toBe(404);

    const body = (await response.json()) as { code: number; message: string };
    expect(body.code).toBe(-1);
    expect(body.message).toBe("ai model not found");
  });

  it("DELETE /ai-models/:id removes the model under the ok envelope", async () => {
    const created = await createModel({
      provider: "openai",
      modelId: "admin-delete-target",
      displayName: "Delete Target",
      mediaType: "text",
      creditPrice: 1,
    });

    const response = await adminRequest(`/${created.id}`, { method: "DELETE" });
    expect(response.status).toBe(200);

    const body = (await response.json()) as { code: number; message: string };
    expect(body).toEqual({ code: 0, message: "ok" });

    const gone = await adminRequest(`/${created.id}`, jsonInit("PATCH", { enabled: true }));
    expect(gone.status).toBe(404);
  });
});
