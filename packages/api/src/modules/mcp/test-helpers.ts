import type { Database } from "@openstarter/db/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { sql } from "drizzle-orm";
import { vi } from "vitest";

import {
  closeApiTestDatabase,
  createApiTestDatabase,
  resetApiTestDatabase,
} from "../../test/api-test-database";

const NOW_EXPR = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
  currentUserId: "user-1" as string,
}));

vi.mock("@openstarter/auth", () => ({
  getUserPlan: vi.fn(async (userId: string) => ({ plan: "none" as const, userId })),
}));

vi.mock(
  "@openstarter/db/server",
  async (importOriginal: () => Promise<typeof import("@openstarter/db/server")>) => {
    const actual = await importOriginal();
    return {
      ...actual,
      db: () => {
        if (!state.database) {
          throw new Error("mcp test database not initialized");
        }
        return state.database;
      },
    };
  },
);

const RESHAPE_TABLES = [
  `DROP TABLE IF EXISTS "order"`,
  `CREATE TABLE "order" (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_email TEXT,
    payment_provider TEXT NOT NULL,
    payment_type TEXT,
    payment_session_id TEXT,
    payment_result TEXT,
    payment_user_id TEXT,
    payment_user_name TEXT,
    payment_email TEXT,
    payment_amount INTEGER,
    payment_currency TEXT,
    payment_product_id TEXT,
    payment_interval TEXT,
    payment_method TEXT,
    product_id TEXT,
    product_name TEXT,
    plan_name TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL,
    description TEXT,
    discount_code TEXT,
    discount_amount INTEGER,
    discount_currency TEXT,
    credits_amount INTEGER,
    credits_valid_days INTEGER,
    checkout_url TEXT,
    checkout_info TEXT NOT NULL DEFAULT '{}',
    checkout_result TEXT,
    callback_url TEXT,
    transaction_id TEXT,
    invoice_id TEXT,
    invoice_url TEXT,
    subscription_id TEXT,
    subscription_no TEXT,
    subscription_result TEXT,
    paid_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    deleted_at INTEGER
  )`,
  `DROP TABLE IF EXISTS ai_task`,
  `CREATE TABLE ai_task (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    media_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL,
    scene TEXT NOT NULL DEFAULT '',
    task_id TEXT,
    task_info TEXT,
    task_result TEXT,
    options TEXT,
    cost_credits INTEGER NOT NULL DEFAULT 0,
    credit_id TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    deleted_at INTEGER
  )`,
  "DROP TABLE IF EXISTS chat_message",
  "DROP TABLE IF EXISTS chat",
  "DROP TABLE IF EXISTS ticket_message",
  "DROP TABLE IF EXISTS ticket",
  `CREATE TABLE chat (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    parts TEXT NOT NULL DEFAULT '[]',
    content TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE chat_message (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'success',
    parts TEXT NOT NULL DEFAULT '[]',
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE ticket (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE ticket_message (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    content TEXT NOT NULL,
    attachments TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  )`,
];

export interface McpTestHarness {
  callTool: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    isError?: boolean;
    content: Array<{ type: string; text?: string }>;
    structuredContent?: unknown;
  }>;
  close: () => Promise<void>;
  reset: () => Promise<void>;
  listTools: () => Promise<Array<{ name: string; description?: string }>>;
}

export const getCurrentUserId = (): string => state.currentUserId;
export const setCurrentUserId = (userId: string): void => {
  state.currentUserId = userId;
};

export const getDatabase = (): Database => state.database as Database;

export const createMcpTestHarness = async (
  suiteName: string,
  buildFetch: () => (request: Request) => Promise<Response>,
): Promise<McpTestHarness> => {
  state.database = await createApiTestDatabase(suiteName);
  await RESHAPE_TABLES.reduce(async (previous, statement) => {
    await previous;
    await (state.database as Database).run(sql.raw(statement));
  }, Promise.resolve());
  await resetApiTestDatabase(state.database);

  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/api/mcp"), {
    fetch: (url, init) => buildFetch()(new Request(url, init)),
  });
  const client = new Client({ name: "mcp-test", version: "1.0.0" });
  await client.connect(transport);

  return {
    callTool: (name, args = {}) => client.callTool({ name, arguments: args }),
    reset: async () => {
      await resetApiTestDatabase(state.database as Database);
    },
    listTools: async () => {
      const { tools } = await client.listTools();
      return tools;
    },
    close: async () => {
      await client.close();
      if (state.database) {
        closeApiTestDatabase(state.database);
      }
    },
  };
};

export { insertUser } from "../../test/api-test-database";
