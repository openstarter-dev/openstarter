import type { Database } from "../db";
import { createSqliteTestDb, disposeSqliteTestDb } from "../db/testing";
import { sql } from "../db/orm";

const CREATE_TABLE_STATEMENTS = [
  `create table user (
    id text primary key,
    name text not null,
    email text not null unique,
    email_verified integer not null default 0,
    image text,
    created_at integer not null,
    updated_at integer not null,
    utm_source text not null default '',
    ip text not null default '',
    locale text not null default '',
    ban_expires integer,
    banned integer not null default 0,
    ban_reason text,
    is_anonymous integer not null default 0,
    role text,
    two_factor_enabled integer not null default 0
  )`,
  `create table subscription (
    id text primary key,
    subscription_no text not null unique,
    user_id text not null,
    user_email text,
    status text not null,
    payment_provider text not null,
    subscription_id text not null,
    subscription_result text,
    product_id text,
    description text,
    amount integer,
    currency text,
    interval text,
    interval_count integer,
    trial_period_days integer,
    current_period_start integer,
    current_period_end integer,
    created_at integer not null,
    updated_at integer not null,
    deleted_at integer,
    plan_name text,
    billing_url text,
    product_name text,
    credits_amount integer,
    credits_valid_days integer,
    payment_product_id text,
    payment_user_id text,
    canceled_at integer,
    canceled_end_at integer,
    canceled_reason text,
    canceled_reason_type text
  )`,
  `create table invite_code (
    id text primary key,
    code text not null unique,
    max_uses integer not null default 1,
    used_count integer not null default 0,
    trial_days integer not null default 15,
    note text default '',
    created_by text,
    expires_at integer,
    created_at integer not null
  )`,
  `create table user_invite (
    id text primary key,
    user_id text not null unique,
    invite_code_id text not null,
    activated_at integer not null,
    trial_ends_at integer not null
  )`,
  `create table credit (
    id text primary key,
    user_id text not null,
    user_email text,
    order_no text,
    subscription_no text,
    transaction_no text not null unique,
    transaction_type text not null,
    transaction_scene text,
    credits integer not null,
    remaining_credits integer not null default 0,
    description text,
    expires_at integer,
    status text not null,
    created_at integer not null,
    updated_at integer not null,
    deleted_at integer,
    consumed_detail text,
    metadata text
  )`,
] as const;

const DATA_TABLES = ["credit", "user_invite", "invite_code", "subscription", "user"] as const;

const runStatements = (database: Database, statements: readonly string[]) =>
  statements.reduce<Promise<void>>(
    (pending, statement) =>
      pending.then(async () => {
        await database.run(sql.raw(statement));
      }),
    Promise.resolve(),
  );

export const createAuthTestDatabase = async () => {
  const database = await createSqliteTestDb();
  await runStatements(database, CREATE_TABLE_STATEMENTS);
  return database;
};

export const closeAuthTestDatabase = async (database: Database) => {
  await disposeSqliteTestDb(database);
};

export const resetAuthTestDatabase = (
  database: Awaited<ReturnType<typeof createAuthTestDatabase>>,
) =>
  runStatements(
    database,
    DATA_TABLES.map((tableName) => `delete from ${tableName}`),
  );
