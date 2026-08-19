// Property tests for the tickets service (Task 28).
//
// Reuses the in-memory SQLite harness in `src/test/api-test-database.ts`. The
// committed harness DDL predates the active tickets schema (it declares legacy
// `description` / `sender` / `message` / `ticket_no` columns that the service no
// longer writes), so we drop & recreate the `ticket` and `ticket_message` tables
// in-shape (matching `packages/db/src/schema/schema.sqlite.ts`) right after the
// harness is created. No other source file is touched.

import type { Database } from "@openstarter/db/server";
import { sql } from "drizzle-orm";
import fc from "fast-check";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeApiTestDatabase,
  createApiTestDatabase,
  insertUser,
  resetApiTestDatabase,
} from "../../../test/api-test-database";
import {
  addMessage,
  createTicket,
  getTicketMessages,
  listAllTickets,
  listUserTickets,
  type TicketStatus,
  updateTicketStatus,
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
        throw new Error("tickets test database not initialized");
      }
      return state.database;
    },
  };
});

const RESHAPE_TABLES = [
  "DROP TABLE IF EXISTS ticket_message",
  "DROP TABLE IF EXISTS ticket",
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

const seedUser = async (database: Database, id: string) => insertUser(database, { id });

describe("tickets service (P44, P45, P46)", () => {
  const getDatabase = (): Database => state.database as Database;

  beforeAll(async () => {
    state.database = await createApiTestDatabase("tickets-property");
    await RESHAPE_TABLES.reduce(async (previous, statement) => {
      await previous;
      await (state.database as Database).run(sql.raw(statement));
    }, Promise.resolve());
  });
  afterAll(() => {
    if (state.database) {
      closeApiTestDatabase(state.database);
    }
  });
  beforeEach(async () => {
    if (state.database) {
      await resetApiTestDatabase(state.database);
    }
  });

  // **Property 44: 工单创建产生 open 状态与首条用户消息**
  it("P44 createTicket yields an open ticket with exactly one user message carrying the provided content", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 40, minLength: 1 }),
        fc.string({ maxLength: 200, minLength: 1 }),
        fc.string({ maxLength: 40, minLength: 1 }).map((s) => `user-${s}`),
        async (title, content, userId) => {
          const database = getDatabase();
          await resetApiTestDatabase(database);
          await seedUser(database, userId);
          const created = await createTicket({ content, title, userId });

          expect(created.status).toBe("open");
          expect(created.userId).toBe(userId);
          expect(created.title).toBe(title);

          const messages = await getTicketMessages(created.id);
          expect(messages).toHaveLength(1);
          const firstMessage = messages[0] as {
            content: string;
            role: string;
            userId: string;
          };
          expect(firstMessage.role).toBe("user");
          expect(firstMessage.userId).toBe(userId);
          expect(firstMessage.content).toBe(content);
        },
      ),
      { numRuns: 20 },
    );
  });

  // **Property 45: 工单状态迁移**
  it("P45 ticket transitions: fresh=open, admin reply→replied, user reply→open, status update→closed", async () => {
    const transition = fc.constantFrom<"reply-admin" | "reply-user" | "close">(
      "reply-admin",
      "reply-user",
      "close",
    );

    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 40, minLength: 1 }),
        fc.string({ maxLength: 200, minLength: 1 }),
        fc.string({ maxLength: 40, minLength: 1 }).map((s) => `user-${s}`),
        transition,
        async (title, content, userId, action) => {
          const database = getDatabase();
          await resetApiTestDatabase(database);
          await seedUser(database, userId);
          const created = await createTicket({ content, title, userId });

          expect(created.status).toBe("open");

          let expected: TicketStatus;
          if (action === "reply-admin") {
            await addMessage({
              content: "admin reply",
              role: "admin",
              ticketId: created.id,
              userId,
            });
            expected = "replied";
          } else if (action === "reply-user") {
            await addMessage({
              content: "user reply",
              role: "user",
              ticketId: created.id,
              userId,
            });
            expected = "open";
          } else {
            expected = "closed";
          }

          const afterAction = await updateTicketStatus(created.id, expected);
          expect(afterAction?.status).toBe(expected);

          if (action === "reply-admin") {
            const reopened = await updateTicketStatus(created.id, "open");
            expect(reopened?.status).toBe("open");
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  // **Property 46: 工单访问隔离**
  it("P46 listing as a user returns only that user's tickets; listing as admin returns all seeded tickets", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 6, min: 2 }),
        fc.integer({ max: 12, min: 1 }),
        fc.integer({ max: 5, min: 0 }),
        async (userCount, ticketsPerUser, oneUserIndex) => {
          const database = getDatabase();
          await resetApiTestDatabase(database);
          const pageSize = 100;
          const userIds = Array.from({ length: userCount }, (_, index) => `owner-${index}`);
          await userIds.reduce(async (previous, userId) => {
            await previous;
            await seedUser(database, userId);
          }, Promise.resolve());

          const expectedPerUser = new Map<string, number>();
          for (const userId of userIds) {
            expectedPerUser.set(userId, 0);
          }
          const ticketJobs = Array.from({ length: userCount * ticketsPerUser }, (_, index) => ({
            ticketIndex: Math.floor(index / userCount),
            userIndex: index % userCount,
          }));
          await ticketJobs.reduce(async (previous, { userIndex }) => {
            await previous;
            const userId = userIds[userIndex] as string;
            await createTicket({
              content: `c-${userIndex}`,
              title: `t-${userIndex}`,
              userId,
            });
            expectedPerUser.set(userId, (expectedPerUser.get(userId) ?? 0) + 1);
          }, Promise.resolve());

          const totalSeeded = userCount * ticketsPerUser;
          const adminList = await listAllTickets({ pageSize });
          expect(adminList.total).toBe(totalSeeded);
          expect(adminList.items).toHaveLength(totalSeeded);

          const probeIndex = oneUserIndex % userCount;
          const probeUserId = userIds[probeIndex] as string;
          const userList = await listUserTickets({
            pageSize,
            userId: probeUserId,
          });
          const probeExpected = expectedPerUser.get(probeUserId) ?? 0;
          expect(userList.total).toBe(probeExpected);
          expect(userList.items).toHaveLength(probeExpected);
          for (const item of userList.items) {
            expect(item.userId).toBe(probeUserId);
          }

          const otherOwners = userIds.filter((id) => id !== probeUserId);
          await otherOwners.reduce(async (previous, otherId) => {
            await previous;
            const otherList = await listUserTickets({
              pageSize,
              userId: otherId,
            });
            const otherExpected = expectedPerUser.get(otherId) ?? 0;
            expect(otherList.total).toBe(otherExpected);
            expect(otherList.items).toHaveLength(otherExpected);
            for (const item of otherList.items) {
              expect(item.userId).toBe(otherId);
              expect(item.userId).not.toBe(probeUserId);
            }
          }, Promise.resolve());
        },
      ),
      { numRuns: 20 },
    );
  }, 30_000);
});
