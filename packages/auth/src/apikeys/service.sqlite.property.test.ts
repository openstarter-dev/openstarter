import { apikey } from "@openstarter/db/schema";
import { createDb } from "@openstarter/db/server";
import { sql } from "drizzle-orm";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";

import { createDatabaseApiKeyRepository } from "./service";

const database = createDb({
  provider: "sqlite",
  singleton: false,
  url: ":memory:",
});

beforeAll(async () => {
  await database.run(sql`
    CREATE TABLE apikey (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    )
  `);
});

const nonEmptyString = fc.string({ maxLength: 64, minLength: 1 });

const PUBLIC_LIST_FIELDS = ["createdAt", "id", "keyPrefix", "status", "title"];

describe("API key SQLite repository properties", () => {
  it("P14 production Drizzle list projection exposes only key prefixes", async () => {
    const repository = createDatabaseApiKeyRepository(() => database);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(nonEmptyString, { maxLength: 12 }),
        async (userId, titles) => {
          await database.delete(apikey);
          const now = new Date("2026-01-01T00:00:00.000Z");
          if (titles.length > 0) {
            await database.insert(apikey).values(
              titles.map((title, index) => ({
                createdAt: now,
                id: `${userId}-${index}`,
                keyHash: `secret-hash-${index}`,
                keyPrefix: `sk_prefix${index}`,
                status: "active",
                title,
                updatedAt: now,
                userId,
              })),
            );
          }

          const result = await repository.listActive({
            page: 1,
            pageSize: 100,
            userId,
          });

          expect(result.total).toBe(titles.length);
          expect(result.items).toHaveLength(titles.length);
          for (const item of result.items) {
            expect(Object.keys(item).sort()).toEqual(PUBLIC_LIST_FIELDS);
            expect(item.keyPrefix.startsWith("sk_")).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
