// In-memory SQLite test harness shared by packages/api property tests.
//
// Returns a createDb()-backed handle with all 22 Phase 0-5 tables pre-created
// (sqlite shapes). Test code then mocks `@openstarter/db/server` to route `db()`
// to this instance. Each test file owns a fresh database file so the fast-check
// iterations cannot bleed state between rows.

import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "@openstarter/db";
import { createDb } from "@openstarter/db";
import { sql } from "drizzle-orm";

const NOW_EXPR = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

const CREATE_TABLE_STATEMENTS: readonly string[] = [
  `CREATE TABLE user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    utm_source TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    locale TEXT NOT NULL DEFAULT '',
    ban_expires INTEGER,
    banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    role TEXT,
    two_factor_enabled INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE subscription (
    id TEXT PRIMARY KEY,
    subscription_no TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_email TEXT,
    status TEXT NOT NULL,
    payment_provider TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    subscription_result TEXT,
    product_id TEXT,
    description TEXT,
    amount INTEGER,
    currency TEXT,
    interval TEXT,
    interval_count INTEGER,
    trial_period_days INTEGER,
    current_period_start INTEGER,
    current_period_end INTEGER,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    deleted_at INTEGER,
    plan_name TEXT,
    billing_url TEXT,
    product_name TEXT,
    credits_amount INTEGER,
    credits_valid_days INTEGER,
    payment_product_id TEXT,
    payment_user_id TEXT,
    canceled_at INTEGER,
    canceled_end_at INTEGER,
    canceled_reason TEXT,
    canceled_reason_type TEXT
  )`,
  `CREATE TABLE "order" (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_email TEXT,
    payment_provider TEXT NOT NULL,
    product_id TEXT,
    product_name TEXT,
    amount INTEGER,
    currency TEXT,
    status TEXT NOT NULL,
    transaction_id TEXT,
    payment_session_id TEXT,
    payment_result TEXT,
    payment_user_id TEXT,
    payment_product_id TEXT,
    payment_subscription_id TEXT,
    payment_method TEXT,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    deleted_at INTEGER
  )`,
  `CREATE TABLE credit (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT,
    order_no TEXT,
    subscription_no TEXT,
    transaction_no TEXT NOT NULL UNIQUE,
    transaction_type TEXT NOT NULL,
    transaction_scene TEXT,
    credits INTEGER NOT NULL,
    remaining_credits INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    expires_at INTEGER,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    deleted_at INTEGER,
    consumed_detail TEXT,
    metadata TEXT
  )`,
  `CREATE TABLE ai_task (
    id TEXT PRIMARY KEY,
    task_no TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_email TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    media_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options TEXT,
    status TEXT NOT NULL,
    result_url TEXT,
    error TEXT,
    cost_credits INTEGER NOT NULL DEFAULT 0,
    credit_id TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    deleted_at INTEGER
  )`,
  `CREATE TABLE ticket (
    id TEXT PRIMARY KEY,
    ticket_no TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_email TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    category TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    closed_at INTEGER
  )`,
  `CREATE TABLE ticket_message (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_email TEXT,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    attachments TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR}
  )`,
  `CREATE TABLE post (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    cover_image TEXT,
    category_id TEXT,
    tags TEXT,
    author TEXT,
    status TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    published_at INTEGER,
    deleted_at INTEGER
  )`,
  `CREATE TABLE taxonomy (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL,
    parent_id TEXT,
    status TEXT NOT NULL,
    description TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    deleted_at INTEGER
  )`,
];

const ALL_TABLES = [
  "ticket_message",
  "ticket",
  "ai_task",
  "credit",
  "order",
  "subscription",
  "post",
  "taxonomy",
  "user",
] as const;

const databasePaths = new WeakMap<object, string>();

const removeDatabaseFiles = (path: string) => {
  rmSync(path, { force: true });
  rmSync(`${path}-shm`, { force: true });
  rmSync(`${path}-wal`, { force: true });
};

/**
 * Create a per-suite sqlite database with the 9 Phase 0-5 tables used by
 * api property tests (subscription, order, credit, ai_task, ticket,
 * ticket_message, post, taxonomy, user). Tests that only need a subset may
 * seed only the rows they require.
 */
export const createApiTestDatabase = async (suiteName: string) => {
  const databasePath = join(tmpdir(), `openstarter-api-${process.pid}-${suiteName}.sqlite`);
  removeDatabaseFiles(databasePath);
  const database = createDb({
    provider: "sqlite",
    url: `file:${databasePath}`,
  });
  databasePaths.set(database, databasePath);
  await CREATE_TABLE_STATEMENTS.reduce(async (previous, statement) => {
    await previous;
    await database.run(sql.raw(statement));
  }, Promise.resolve());
  return database;
};

export const closeApiTestDatabase = (database: Database) => {
  const path = databasePaths.get(database);
  if (path) {
    removeDatabaseFiles(path);
    databasePaths.delete(database);
  }
};

export const resetApiTestDatabase = (database: Database) =>
  Promise.all(
    ALL_TABLES.map((table) =>
      database.run(sql.raw(`DELETE FROM ${table === "order" ? '"order"' : table}`)),
    ),
  );

/** Insert a single user row with sensible defaults; tests override only what they assert on. */
export const insertUser = async (
  database: Database,
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  }> = {},
) => {
  const id = overrides.id ?? "user-1";
  await database.run(
    sql`INSERT INTO user (id, name, email, email_verified)
        VALUES (${id}, ${overrides.name ?? "Test"}, ${overrides.email ?? `test-${id}@example.com`}, ${overrides.emailVerified ? 1 : 0})`,
  );
  return id;
};
