/**
 * AI model catalog service tests — in-memory SQLite with the local DDL pattern.
 *
 * Reuses the `vi.mock("@openstarter/db/server")` + in-file `CREATE TABLE`
 * harness from `modules/ai/llm/__tests__/llm.test.ts`. The `ai_model` DDL mirrors
 * the Task 2 sqlite schema (snake_case columns + the
 * `uq_ai_model_provider_model` unique index). Provider availability is mocked
 * at both seams: `../llm/provider` (LLM side) and `../ai/manager` (media side).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";
import type { Database } from "@openstarter/db";
import { createSqliteTestDb } from "@openstarter/db/testing";
import {
  createModel,
  deleteModel,
  DuplicateModelError,
  findModelByProviderAndId,
  listAvailableModelsByMediaType,
  listModels,
  updateModel,
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
        throw new Error("ai-catalog test database not initialized");
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
  dbPath = join(tmpDir, `ai-catalog-test-${Date.now()}.db`);

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

describe("AI Catalog Service", () => {
  describe("listAvailableModelsByMediaType", () => {
    it("groups enabled models by media type and filters unavailable providers", async () => {
      await createModel({
        provider: "openai",
        modelId: "gpt-4o-mini",
        displayName: "GPT-4o mini",
        mediaType: "text",
        creditPrice: 1,
      });
      await createModel({
        provider: "replicate",
        modelId: "flux-pro",
        displayName: "FLUX Pro",
        mediaType: "image",
        creditPrice: 5,
      });
      await createModel({
        provider: "fal",
        modelId: "seedance",
        displayName: "Seedance",
        mediaType: "video",
        creditPrice: 20,
      });
      // Enabled filter: a disabled model must not appear even if its provider is available.
      await createModel({
        provider: "openai",
        modelId: "o3-mini",
        displayName: "o3-mini (disabled)",
        mediaType: "text",
        creditPrice: 2,
        enabled: false,
      });

      // fal 未装配 → 不可用；openai/replicate 可用
      const grouped = await listAvailableModelsByMediaType();

      expect(grouped.text.map((m) => m.modelId)).toEqual(["gpt-4o-mini"]);
      expect(grouped.image.map((m) => m.modelId)).toEqual(["flux-pro"]);
      expect(grouped.video).toEqual([]);
      expect(grouped.music).toEqual([]);
      expect(grouped.speech).toEqual([]);
      expect(Object.keys(grouped).sort()).toEqual(["image", "music", "speech", "text", "video"]);
    });
  });

  describe("createModel", () => {
    it("rejects duplicate provider+modelId", async () => {
      // Unique key: gpt-4o-mini already exists from the grouping test (shared in-file DB).
      await createModel({
        provider: "openai",
        modelId: "dup-check",
        displayName: "x",
        mediaType: "text",
        creditPrice: 1,
      });
      await expect(
        createModel({
          provider: "openai",
          modelId: "dup-check",
          displayName: "y",
          mediaType: "text",
          creditPrice: 1,
        }),
      ).rejects.toBeInstanceOf(DuplicateModelError);
    });

    it("generates the id server-side and returns the full record", async () => {
      const created = await createModel({
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
        displayName: "Claude Sonnet 4.6",
        mediaType: "text",
        creditPrice: 3,
      });

      expect(created.id).toBeTruthy();
      expect(created.provider).toBe("anthropic");
      expect(created.modelId).toBe("claude-sonnet-4-6");
      expect(created.enabled).toBe(true);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("updateModel and deleteModel round-trip", () => {
    it("disables via updateModel, hides from enabledOnly list, then deletes", async () => {
      const created = await createModel({
        provider: "openai",
        modelId: "gpt-4o",
        displayName: "GPT-4o",
        mediaType: "text",
        creditPrice: 5,
      });

      const updated = await updateModel({ id: created.id, enabled: false });
      expect(updated?.enabled).toBe(false);

      const enabledOnly = await listModels({ enabledOnly: true });
      expect(enabledOnly.find((m) => m.id === created.id)).toBeUndefined();

      expect(await deleteModel(created.id)).toBe(true);
      expect(await findModelByProviderAndId("openai", "gpt-4o")).toBeNull();
    });

    it("reports null/false for missing models", async () => {
      expect(await updateModel({ id: "missing-id", displayName: "nope" })).toBeNull();
      expect(await deleteModel("missing-id")).toBe(false);
      expect(await findModelByProviderAndId("openai", "non-existent")).toBeNull();
    });
  });
});
