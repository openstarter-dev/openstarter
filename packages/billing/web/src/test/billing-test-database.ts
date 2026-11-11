// In-memory SQLite test harness for packages/billing property tests.
//
// Returns a createDb()-backed handle with the subset of Phase 0-5 tables used
// by billing service tests (subscription, order, credit, user) plus the
// referral-domain tables (referral, referral_relation, commission, config).

import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "@openstarter/db";
import { createSqliteTestDb } from "@openstarter/db/testing";
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
    deleted_at INTEGER,
    callback_url TEXT,
    checkout_info TEXT,
    checkout_result TEXT,
    checkout_url TEXT,
    credits_amount INTEGER,
    credits_valid_days INTEGER,
    discount_amount INTEGER,
    discount_code TEXT,
    discount_currency TEXT,
    invoice_id TEXT,
    invoice_url TEXT,
    payment_amount INTEGER,
    payment_currency TEXT,
    payment_email TEXT,
    payment_interval TEXT,
    payment_user_name TEXT,
    plan_name TEXT,
    subscription_id TEXT,
    subscription_no TEXT,
    subscription_result TEXT,
    payment_type TEXT,
    paid_at INTEGER
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
  `CREATE TABLE referral (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    custom_rate INTEGER,
    note TEXT DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR}
  )`,
  `CREATE TABLE referral_relation (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR}
  )`,
  `CREATE TABLE commission (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    referrer_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL,
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
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR}
  )`,
  `CREATE TABLE config (
    name TEXT NOT NULL UNIQUE,
    value TEXT
  )`,
];

const DATA_TABLES = [
  '"order"',
  "commission",
  "config",
  "credit",
  "referral",
  "referral_relation",
  "subscription",
  "user",
] as const;

const databasePaths = new WeakMap<object, string>();

const removeDatabaseFiles = (path: string) => {
  rmSync(path, { force: true });
  rmSync(`${path}-shm`, { force: true });
  rmSync(`${path}-wal`, { force: true });
};

export const createBillingTestDatabase = async (suiteName: string) => {
  const databasePath = join(tmpdir(), `openstarter-billing-${process.pid}-${suiteName}.sqlite`);
  removeDatabaseFiles(databasePath);
  const database = createSqliteTestDb(`file:${databasePath}`);
  databasePaths.set(database, databasePath);
  await CREATE_TABLE_STATEMENTS.reduce(async (previous, statement) => {
    await previous;
    await database.run(sql.raw(statement));
  }, Promise.resolve());
  return database;
};

export const closeBillingTestDatabase = (database: Database) => {
  const path = databasePaths.get(database);
  if (path) {
    removeDatabaseFiles(path);
    databasePaths.delete(database);
  }
};

export const resetBillingTestDatabase = (database: Database) =>
  Promise.all(DATA_TABLES.map((table) => database.run(sql.raw(`DELETE FROM ${table}`))));
