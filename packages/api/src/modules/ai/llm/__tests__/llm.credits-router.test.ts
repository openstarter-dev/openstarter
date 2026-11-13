import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";
import type { Database } from "@openstarter/db";
import { createSqliteTestDb } from "@openstarter/db/testing";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
  preloadChatCredits: vi.fn(),
  settleChatCredits: vi.fn(),
  getAdapter: vi.fn(),
  chat: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("llm credits router test database not initialized");
      }
      return state.database;
    },
  };
});

vi.mock("@openstarter/billing-web", () => ({
  revoke: state.revoke,
}));

vi.mock("@openstarter/auth", () => ({
  getUserPlan: vi.fn(),
}));

vi.mock("@openstarter/auth/server", () => ({
  createAuth: vi.fn(() => ({ api: { getSession: vi.fn(async () => null) } })),
}));

vi.mock("../../../../middleware/auth", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware<{ Variables: { session: null } }>(async (_c, next) => {
    await next();
  });
  const requireAuth = createMiddleware<{
    Variables: { userId: string; session: null };
  }>(async (c, next) => {
    c.set("session", null);
    c.set("userId", c.req.header("x-test-user-id") ?? "test-user");
    await next();
  });
  return { apiKeyAuth: requireAuth, authMiddleware: passthrough, requireAuth };
});

vi.mock("../../../../middleware/plan-gate", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware(async (_c, next) => {
    await next();
  });
  return { requirePlan: () => passthrough };
});

vi.mock("../credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../credits")>();
  return {
    ...actual,
    preloadChatCredits: state.preloadChatCredits,
    settleChatCredits: state.settleChatCredits,
  };
});

vi.mock("../provider", () => ({
  getAdapter: state.getAdapter,
  isLLMEnabled: () => Promise.resolve(true),
}));

vi.mock("@tanstack/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/ai")>();
  return { ...actual, chat: state.chat };
});

import { createChat, createMessage } from "../service";
import { llmRouter } from "../router";
import { InsufficientCreditsError } from "../../tasks/service";

type AnyMiddleware = {
  onFinish?: (ctx: unknown, info: unknown) => unknown;
};

function fakeChat(mode: "finish" | "error", content: string, totalTokens: number) {
  return (options: { middleware?: Array<AnyMiddleware> }) =>
    (async function* () {
      yield { type: "TEXT_MESSAGE_CONTENT", delta: content };
      if (mode === "finish") {
        for (const middleware of options.middleware ?? []) {
          await middleware.onFinish?.(
            {},
            {
              finishReason: "stop",
              duration: 1,
              content,
              usage: { totalTokens, promptTokens: 10, completionTokens: totalTokens - 10 },
            },
          );
        }
        yield { type: "RUN_FINISHED" };
      }
      if (mode === "error") throw new Error("upstream died");
    })();
}

const SENTINEL_ADAPTER = { adapter: { sentinel: true }, maxTokensKey: "max_tokens" };

function sendMessage(path: string, init: RequestInit = {}) {
  return llmRouter.request(path, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-test-user-id": TEST_USER_ID },
  });
}

function jsonInit(chatId: string, content: string): RequestInit {
  return {
    body: JSON.stringify({
      threadId: chatId,
      messages: [{ id: "m1", role: "user", parts: [{ type: "text", content }] }],
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  };
}

async function seedChatWithHistory(): Promise<string> {
  const created = await createChat({
    userId: TEST_USER_ID,
    provider: "openai",
    model: "gpt-4o-mini",
  });
  const chatId = created.id as string;
  await createMessage({
    chatId,
    userId: TEST_USER_ID,
    role: "user",
    content: "hello from history",
  });
  return chatId;
}

const NOW_MS = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

const CREATE_CHAT = `CREATE TABLE chat (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT,
  metadata TEXT,
  model TEXT NOT NULL,
  parts TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

const CREATE_CHAT_MESSAGE = `CREATE TABLE chat_message (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  parts TEXT NOT NULL,
  metadata TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

const TEST_USER_ID = "test-user-llm-credits";

let dbPath: string | undefined;

beforeAll(async () => {
  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { join } = await import("node:path");
  dbPath = join(tmpDir, `llm-credits-router-test-${Date.now()}.db`);

  const database = createSqliteTestDb(`file://${dbPath}`);

  await database.run(sql.raw(CREATE_CHAT));
  await database.run(sql.raw(CREATE_CHAT_MESSAGE));

  state.database = database;
});

afterAll(() => {
  if (dbPath) {
    import("node:fs").then((fs) => fs.rmSync(dbPath!, { force: true }));
  }
  state.database = undefined;
});

describe("POST /llm/chats/:id/messages — credit wiring", () => {
  beforeEach(() => {
    state.chat.mockReset();
    state.settleChatCredits.mockReset();
    state.preloadChatCredits.mockReset();
    state.revoke.mockReset();
    state.getAdapter.mockReset();
    state.getAdapter.mockResolvedValue(SENTINEL_ADAPTER);
  });

  it("returns 402 and persists no user message when preload throws InsufficientCreditsError", async () => {
    const chatId = await seedChatWithHistory();
    state.preloadChatCredits.mockRejectedValue(new InsufficientCreditsError());

    const response = await sendMessage(`/llm/chats/${chatId}/messages`, jsonInit(chatId, "hi"));

    expect(response.status).toBe(402);
    const body = (await response.json()) as { code: number; message: string; data: unknown };
    expect(body.message).toBe("insufficient credits");
    expect(body.data).toBeUndefined();

    const history = await state.database
      ?.select()
      .from((await import("@openstarter/db/schema")).chatMessage);
    const userRows = (history ?? []).filter((m) => m.chatId === chatId);
    expect(userRows).toHaveLength(1);
    expect(state.settleChatCredits).not.toHaveBeenCalled();
    expect(state.chat).not.toHaveBeenCalled();
  });

  it("streams and forwards preload args (userId, chatId, provider, model, historyChars) on success", async () => {
    const chatId = await seedChatWithHistory();
    state.chat.mockImplementation((_o: unknown) =>
      fakeChat("finish", "mock reply", 100)(_o as never),
    );
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: "c1",
      estimatedCost: 5,
      maxOutputTokens: 4096,
    });

    const response = await sendMessage(`/llm/chats/${chatId}/messages`, jsonInit(chatId, "hi"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    expect(state.preloadChatCredits).toHaveBeenCalledTimes(1);
    expect(state.preloadChatCredits).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      chatId,
      provider: "openai",
      model: "gpt-4o-mini",
      historyChars: expect.any(Number),
    });

    const history = await state.database
      ?.select()
      .from((await import("@openstarter/db/schema")).chatMessage);
    const userRows = (history ?? []).filter((m) => m.chatId === chatId && m.role === "user");
    expect(userRows).toHaveLength(2);
  });

  it("passes maxOutputTokens from preload to chat modelOptions and settles credits in onFinish", async () => {
    const chatId = await seedChatWithHistory();
    state.chat.mockImplementation((_o: unknown) =>
      fakeChat("finish", "mock reply", 1234)(_o as never),
    );
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: "c2",
      estimatedCost: 9,
      maxOutputTokens: 2048,
    });

    const response = await sendMessage(`/llm/chats/${chatId}/messages`, jsonInit(chatId, "hi"));
    expect(response.status).toBe(200);
    await response.text();

    expect(state.chat).toHaveBeenCalledTimes(1);
    const chatArgs = state.chat.mock.calls[0]?.[0] as {
      modelOptions?: Record<string, unknown>;
    };
    expect(chatArgs.modelOptions).toEqual({ max_tokens: 2048 });

    expect(state.settleChatCredits).toHaveBeenCalledTimes(1);
    expect(state.settleChatCredits).toHaveBeenCalledWith({
      consumedCreditId: "c2",
      estimatedCost: 9,
      totalTokens: 1234,
      provider: "openai",
      model: "gpt-4o-mini",
    });

    state.settleChatCredits.mockRejectedValueOnce(new Error("settle boom"));
    const chatId2 = await seedChatWithHistory();
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: "c3",
      estimatedCost: 1,
      maxOutputTokens: 4096,
    });
    const response2 = await sendMessage(`/llm/chats/${chatId2}/messages`, jsonInit(chatId2, "hi"));
    expect(response2.status).toBe(200);
    await response2.text();
  });

  it("returns 502 and revokes the preload when getAdapter fails after pre-charging", async () => {
    const chatId = await seedChatWithHistory();
    state.getAdapter.mockRejectedValue(new Error("OpenAI API key not configured (openai_api_key)"));
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: "c-late-fail",
      estimatedCost: 7,
      maxOutputTokens: 4096,
    });

    const response = await sendMessage(`/llm/chats/${chatId}/messages`, jsonInit(chatId, "hi"));

    expect(response.status).toBe(502);
    const body = (await response.json()) as { code: number; message: string };
    expect(body.code).toBe(-1);
    expect(body.message).toBe("OpenAI API key not configured (openai_api_key)");

    expect(state.revoke).toHaveBeenCalledTimes(1);
    expect(state.revoke).toHaveBeenCalledWith({ consumeCreditId: "c-late-fail" });
    expect(state.settleChatCredits).not.toHaveBeenCalled();
    expect(state.chat).not.toHaveBeenCalled();
  });

  it("returns 502 without revoking when no preload was charged (free model) and getAdapter fails", async () => {
    const chatId = await seedChatWithHistory();
    state.getAdapter.mockRejectedValue(new Error("Unknown LLM provider: nope"));
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: null,
      estimatedCost: 0,
      maxOutputTokens: null,
    });

    const response = await sendMessage(`/llm/chats/${chatId}/messages`, jsonInit(chatId, "hi"));

    expect(response.status).toBe(502);
    expect(state.revoke).not.toHaveBeenCalled();
  });
});
