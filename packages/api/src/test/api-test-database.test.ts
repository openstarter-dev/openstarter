import type { createDb } from "@openstarter/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  closeApiTestDatabase,
  createApiTestDatabase,
  insertUser,
  resetApiTestDatabase,
} from "./api-test-database";

const state: { database?: ReturnType<typeof createDb> } = {};

vi.mock("@openstarter/db/server", () => ({
  // The mocked db() returns the per-suite handle; tests overwrite state.database.
  db: () => {
    if (!state.database) {
      throw new Error("test database not initialized");
    }
    return state.database;
  },
}));

const getDatabase = (): NonNullable<typeof state.database> => {
  if (!state.database) {
    throw new Error("test database not initialized");
  }
  return state.database;
};

describe("api-test-database harness smoke", () => {
  beforeAll(async () => {
    state.database = await createApiTestDatabase("smoke");
  });
  afterAll(() => {
    if (state.database) {
      closeApiTestDatabase(state.database);
    }
  });

  it("creates a user row and can read it back", async () => {
    const database = getDatabase();
    const id = await insertUser(database, {});
    const rows = await database.all(
      sql`SELECT id, email FROM user WHERE id = ${id}`
    );
    expect(rows).toHaveLength(1);
    expect((rows[0] as { email: string }).email).toBe(
      "test-user-1@example.com"
    );
  });

  it("resetApiTestDatabase empties user (and dependent) tables", async () => {
    const database = getDatabase();
    await resetApiTestDatabase(database);
    const rows = await database.all(sql`SELECT id FROM user`);
    expect(rows).toHaveLength(0);
  });

  it("subscription, order, credit, ai_task, ticket, ticket_message, post, taxonomy tables exist", async () => {
    const database = getDatabase();
    const TABLES = [
      "subscription",
      '"order"',
      "credit",
      "ai_task",
      "ticket",
      "ticket_message",
      "post",
      "taxonomy",
    ] as const;
    await TABLES.reduce(async (previous, table) => {
      await previous;
      const rows = await database.all(
        sql.raw(`SELECT count(*) AS c FROM ${table}`)
      );
      expect(rows).toHaveLength(1);
    }, Promise.resolve());
  });
});
