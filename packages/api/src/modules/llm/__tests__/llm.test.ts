/**
 * LLM module tests — service layer integration tests with in-memory SQLite.
 *
 * Reuses the in-memory SQLite harness and adds the `chat` / `chat_message`
 * tables that the LLM module depends on.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";
import type { Database } from "@openstarter/db";
import { createDb } from "@openstarter/db";
import {
  createChat,
  getChat,
  getUserChats,
  getChatMessages,
  createMessage,
  getMessageHistory,
  deleteChat,
} from "../service";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("LLM test database not initialized");
      }
      return state.database;
    },
  };
});

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

const TEST_USER_ID = "test-user-llm-001";

let dbPath: string | undefined;

beforeAll(async () => {
  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { join } = await import("node:path");
  dbPath = join(tmpDir, `llm-test-${Date.now()}.db`);

  const database = createDb({
    provider: "sqlite",
    url: `file://${dbPath}`,
    singleton: false,
  });

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

describe("LLM Service", () => {
  describe("createChat", () => {
    it("creates a new chat and returns it", async () => {
      const result = await createChat({
        userId: TEST_USER_ID,
        title: "Test Chat",
        provider: "openai",
        model: "gpt-4o-mini",
      });

      expect(result).toHaveProperty("id");
      expect(result.title).toBe("Test Chat");
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.provider).toBe("openai");
      expect(result.model).toBe("gpt-4o-mini");
      expect(result.status).toBe("active");
    });
  });

  describe("getChat", () => {
    it("retrieves a chat by id and userId", async () => {
      const created = await createChat({
        userId: TEST_USER_ID,
        title: "Get Chat Test",
      });

      const retrieved = await getChat({
        id: created.id as string,
        userId: TEST_USER_ID,
      });

      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe("Get Chat Test");
      expect(retrieved?.userId).toBe(TEST_USER_ID);
    });

    it("returns null for non-existent chat", async () => {
      const result = await getChat({
        id: "non-existent-id",
        userId: TEST_USER_ID,
      });

      expect(result).toBeNull();
    });
  });

  describe("getUserChats", () => {
    it("lists user's chats with pagination", async () => {
      await createChat({ userId: TEST_USER_ID, title: "Chat A" });
      await createChat({ userId: TEST_USER_ID, title: "Chat B" });

      const { items, total } = await getUserChats({
        userId: TEST_USER_ID,
        page: 1,
        pageSize: 10,
      });

      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(total).toBeGreaterThanOrEqual(2);
    });
  });

  describe("createMessage and getChatMessages", () => {
    it("stores and retrieves chat messages", async () => {
      const chat_ = await createChat({
        userId: TEST_USER_ID,
        title: "Message Test",
      });
      const chatId = chat_.id as string;

      await createMessage({
        chatId,
        userId: TEST_USER_ID,
        role: "user",
        content: "Hello!",
      });

      await createMessage({
        chatId,
        userId: TEST_USER_ID,
        role: "assistant",
        content: "Hi there! How can I help?",
      });

      const { items, total } = await getChatMessages({
        chatId,
        userId: TEST_USER_ID,
        page: 1,
      });

      expect(total).toBe(2);
      expect(items.length).toBe(2);
      expect((items[0]! as Record<string, unknown>).role).toBe("user");
      expect((items[0]! as Record<string, unknown>).content).toBe("Hello!");
      expect((items[1]! as Record<string, unknown>).role).toBe("assistant");
      expect((items[1]! as Record<string, unknown>).content).toBe("Hi there! How can I help?");
    });
  });

  describe("getMessageHistory", () => {
    it("returns chronological message history", async () => {
      const chat_ = await createChat({
        userId: TEST_USER_ID,
        title: "History Test",
      });
      const chatId = chat_.id as string;

      await createMessage({
        chatId,
        userId: TEST_USER_ID,
        role: "user",
        content: "First message",
      });

      const history = await getMessageHistory({ chatId, userId: TEST_USER_ID });
      expect(history).toEqual([{ role: "user", content: "First message" }]);
    });
  });

  describe("deleteChat", () => {
    it("deletes a chat", async () => {
      const chat_ = await createChat({
        userId: TEST_USER_ID,
        title: "To Delete",
      });
      const chatId = chat_.id as string;

      await deleteChat({ id: chatId, userId: TEST_USER_ID });

      const retrieved = await getChat({ id: chatId, userId: TEST_USER_ID });
      expect(retrieved).toBeNull();
    });
  });
});
