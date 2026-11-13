import { grant } from "@openstarter/billing-web";
import type { Database } from "@openstarter/db";
import { credit } from "@openstarter/db/schema";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeApiTestDatabase,
  createApiTestDatabase,
  insertUser,
  resetApiTestDatabase,
} from "../../../test/api-test-database";
import { createModel, findModelByProviderAndId } from "../catalog/service";
import { InsufficientCreditsError } from "../tasks/service";
import { preloadChatCredits, settleChatCredits } from "./credits";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("llm credits test database not initialized");
      }
      return state.database;
    },
  };
});

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

const sumRemainingCredits = async (userId: string): Promise<number> => {
  const rows = await state
    .database!.select({ value: sql<number>`coalesce(sum(remaining_credits), 0)` })
    .from(credit)
    .where(
      sql`user_id = ${userId} and transaction_type = 'grant' and status = 'active' and remaining_credits > 0`,
    );
  const value = rows[0]?.value;
  return typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
};

const countConsumeRecords = async (userId: string): Promise<number> => {
  const rows = await state
    .database!.select({ value: sql<number>`count(*)` })
    .from(credit)
    .where(sql`user_id = ${userId} and transaction_type = 'consume'`);
  return Number(rows[0]?.value ?? 0);
};

beforeAll(async () => {
  const database = await createApiTestDatabase("llm-credits");
  state.database = database;
  await database.run(sql.raw(CREATE_AI_MODEL));
  for (const statement of CREATE_AI_MODEL_INDEXES) {
    await database.run(sql.raw(statement));
  }
});

afterAll(() => {
  if (state.database) {
    closeApiTestDatabase(state.database);
  }
});

beforeEach(async () => {
  if (state.database) {
    await resetApiTestDatabase(state.database);
    await state.database.run(sql.raw("DELETE FROM ai_model"));
  }
});

const seedPricedModel = async (
  overrides: Partial<{ creditPrice: number; maxOutputTokens: number | null }> = {},
) => {
  return createModel({
    provider: "openai",
    modelId: "gpt-priced",
    displayName: "GPT Priced",
    mediaType: "text",
    creditPrice: overrides.creditPrice ?? 2,
    maxOutputTokens: "maxOutputTokens" in overrides ? overrides.maxOutputTokens : 4096,
  });
};

describe("preloadChatCredits", () => {
  it("precharges input estimate + capped output and drops the balance by estimatedCost", async () => {
    const userId = "preload-user-1";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await seedPricedModel();

    const result = await preloadChatCredits({
      chatId: "chat-1",
      historyChars: 4000,
      model: "gpt-priced",
      provider: "openai",
      userId,
    });

    expect(result.estimatedCost).toBe(12);
    expect(result.maxOutputTokens).toBe(4096);
    expect(result.consumedCreditId).not.toBeNull();
    expect(await sumRemainingCredits(userId)).toBe(88);

    const consumeRows = await state
      .database!.select()
      .from(credit)
      .where(sql`user_id = ${userId} and transaction_type = 'consume'`);
    expect(consumeRows).toHaveLength(1);
    expect(consumeRows[0]?.credits).toBe(-12);
    expect(consumeRows[0]?.transactionScene).toBe("llm_chat");
    expect(JSON.parse(consumeRows[0]?.metadata ?? "{}")).toEqual({ chatId: "chat-1" });
  });

  it("treats missing catalog entry as free: estimatedCost 0 and no consume record", async () => {
    const userId = "preload-user-2";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });

    const result = await preloadChatCredits({
      chatId: "chat-2",
      historyChars: 4000,
      model: "unknown-model",
      provider: "openai",
      userId,
    });

    expect(result).toEqual({ consumedCreditId: null, estimatedCost: 0, maxOutputTokens: null });
    expect(await sumRemainingCredits(userId)).toBe(100);
    expect(await countConsumeRecords(userId)).toBe(0);
  });

  it("treats creditPrice 0 as free", async () => {
    const userId = "preload-user-3";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await createModel({
      provider: "openai",
      modelId: "gpt-free",
      displayName: "GPT Free",
      mediaType: "text",
      creditPrice: 0,
    });

    const result = await preloadChatCredits({
      chatId: "chat-3",
      historyChars: 4000,
      model: "gpt-free",
      provider: "openai",
      userId,
    });

    expect(result).toEqual({ consumedCreditId: null, estimatedCost: 0, maxOutputTokens: null });
    expect(await countConsumeRecords(userId)).toBe(0);
  });

  it("defaults the output cap to 4096 when the catalog omits maxOutputTokens", async () => {
    const userId = "preload-user-4";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await createModel({
      provider: "openai",
      modelId: "gpt-nocap",
      displayName: "GPT NoCap",
      mediaType: "text",
      creditPrice: 1,
    });

    const result = await preloadChatCredits({
      chatId: "chat-4",
      historyChars: 0,
      model: "gpt-nocap",
      provider: "openai",
      userId,
    });

    expect(result.maxOutputTokens).toBe(4096);
    expect(result.estimatedCost).toBe(Math.ceil(4096 / 1000));
  });

  it("throws InsufficientCreditsError and leaves the balance untouched when funds are short", async () => {
    const userId = "preload-user-5";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 5, description: "seed", userId });
    await seedPricedModel();

    await expect(
      preloadChatCredits({
        chatId: "chat-5",
        historyChars: 4000,
        model: "gpt-priced",
        provider: "openai",
        userId,
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(await sumRemainingCredits(userId)).toBe(5);
    expect(await countConsumeRecords(userId)).toBe(0);
  });
});

describe("settleChatCredits", () => {
  it("nets the balance down to actual when actual < estimated", async () => {
    const userId = "settle-user-1";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await seedPricedModel();

    const preload = await preloadChatCredits({
      chatId: "chat-s1",
      historyChars: 4000, // estimatedCost 12
      model: "gpt-priced",
      provider: "openai",
      userId,
    });
    expect(preload.consumedCreditId).not.toBeNull();
    expect(await sumRemainingCredits(userId)).toBe(88);

    await settleChatCredits({
      consumedCreditId: preload.consumedCreditId,
      estimatedCost: preload.estimatedCost,
      model: "gpt-priced",
      provider: "openai",
      totalTokens: 1500,
    });

    expect(await sumRemainingCredits(userId)).toBe(96);

    const consumeRows = await state
      .database!.select()
      .from(credit)
      .where(sql`user_id = ${userId} and transaction_type = 'consume'`)
      .orderBy(credit.createdAt);
    expect(consumeRows).toHaveLength(2);
    expect(consumeRows[0]?.id).toBe(preload.consumedCreditId);
    expect(consumeRows[0]?.status).toBe("deleted");
    expect(consumeRows[1]?.credits).toBe(-4);
    expect(consumeRows[1]?.status).toBe("active");
  });

  it("keeps the preload when totalTokens is missing", async () => {
    const userId = "settle-user-2";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await seedPricedModel();

    const preload = await preloadChatCredits({
      chatId: "chat-s2",
      historyChars: 4000, // estimatedCost 12
      model: "gpt-priced",
      provider: "openai",
      userId,
    });

    await settleChatCredits({
      consumedCreditId: preload.consumedCreditId,
      estimatedCost: preload.estimatedCost,
      model: "gpt-priced",
      provider: "openai",
      totalTokens: undefined,
    });

    expect(await sumRemainingCredits(userId)).toBe(88);
  });

  it("keeps the preload when actual >= estimated (capped-output edge)", async () => {
    const userId = "settle-user-3";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await seedPricedModel();

    const preload = await preloadChatCredits({
      chatId: "chat-s3",
      historyChars: 4000, // estimatedCost 12
      model: "gpt-priced",
      provider: "openai",
      userId,
    });

    await settleChatCredits({
      consumedCreditId: preload.consumedCreditId,
      estimatedCost: preload.estimatedCost,
      model: "gpt-priced",
      provider: "openai",
      totalTokens: 9000,
    });

    expect(await sumRemainingCredits(userId)).toBe(88);
    const consumeRows = await state
      .database!.select()
      .from(credit)
      .where(sql`user_id = ${userId} and transaction_type = 'consume'`);
    expect(consumeRows).toHaveLength(1);
    expect(consumeRows[0]?.status).toBe("active");
  });

  it("returns immediately for a free session (null consumedCreditId)", async () => {
    const userId = "settle-user-4";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });

    await expect(
      settleChatCredits({
        consumedCreditId: null,
        estimatedCost: 0,
        model: "gpt-priced",
        provider: "openai",
        totalTokens: 1234,
      }),
    ).resolves.toBeUndefined();

    expect(await countConsumeRecords(userId)).toBe(0);
  });

  it("keeps the preload when the consume record cannot be found", async () => {
    const userId = "settle-user-5";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await seedPricedModel();

    await expect(
      settleChatCredits({
        consumedCreditId: "missing-consume-id",
        estimatedCost: 12,
        model: "gpt-priced",
        provider: "openai",
        totalTokens: 1500,
      }),
    ).resolves.toBeUndefined();

    expect(await sumRemainingCredits(userId)).toBe(100);
    expect(await countConsumeRecords(userId)).toBe(0);
  });

  it("keeps the preload when the catalog entry vanished (no price to settle at)", async () => {
    const userId = "settle-user-6";
    await insertUser(state.database!, { email: `${userId}@example.com`, id: userId });
    await grant({ credits: 100, description: "seed", userId });
    await seedPricedModel();

    const preload = await preloadChatCredits({
      chatId: "chat-s6",
      historyChars: 4000,
      model: "gpt-priced",
      provider: "openai",
      userId,
    });
    expect(await sumRemainingCredits(userId)).toBe(88);

    expect(await findModelByProviderAndId("openai", "gpt-priced")).not.toBeNull();
    await state.database!.run(sql.raw(`DELETE FROM ai_model WHERE model_id = 'gpt-priced'`));

    await settleChatCredits({
      consumedCreditId: preload.consumedCreditId,
      estimatedCost: preload.estimatedCost,
      model: "gpt-priced",
      provider: "openai",
      totalTokens: 1500,
    });

    expect(await sumRemainingCredits(userId)).toBe(88);
  });
});
