import type { Database } from "../../db/server";
import { sql } from "../../db/orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createMcpTestHarness,
  getDatabase,
  getCurrentUserId,
  insertUser,
  setCurrentUserId,
} from "./test-helpers";
import type { McpTestHarness } from "./test-helpers";

const TOOL_NAMES = [
  "openstarter_get_profile",
  "openstarter_get_subscription",
  "openstarter_list_credit_history",
  "openstarter_list_orders",
  "openstarter_list_tickets",
  "openstarter_get_ticket_messages",
  "openstarter_create_ticket",
  "openstarter_reply_ticket",
] as const;

const parseStructured = (result: { content: Array<{ type: string; text?: string }> }) =>
  JSON.parse(result.content.find((block) => block.type === "text")?.text ?? "null") as unknown;

const insertOrder = async (
  database: Database,
  overrides: { id: string; orderNo: string; userId: string; productName?: string; amount?: number },
) => {
  await database.run(sql`
    INSERT INTO "order" (id, order_no, user_id, payment_provider, product_name, amount, currency,
                         status, description, created_at, updated_at)
    VALUES (${overrides.id}, ${overrides.orderNo}, ${overrides.userId}, 'stripe',
            ${overrides.productName ?? "Pro"}, ${overrides.amount ?? 990}, 'usd', 'paid', 'test order',
            1700000000000, 1700000000000)
  `);
};

const insertCredit = async (
  database: Database,
  overrides: {
    id: string;
    transactionNo: string;
    userId: string;
    credits: number;
    remainingCredits: number;
    transactionType: string;
    description?: string;
  },
) => {
  await database.run(sql`
    INSERT INTO credit (id, transaction_no, user_id, credits, remaining_credits,
                        transaction_type, transaction_scene, status, expires_at)
    VALUES (${overrides.id}, ${overrides.transactionNo}, ${overrides.userId}, ${overrides.credits},
            ${overrides.remainingCredits}, ${overrides.transactionType}, 'purchase', 'active',
            (cast((julianday('now', '+30 days') - 2440587.5)*86400000 as integer)))
  `);
};

describe("mcp module", () => {
  let harness: McpTestHarness;

  beforeAll(async () => {
    const { mcpHandler } = await import("./server");
    harness = await createMcpTestHarness(
      () => (request) =>
        mcpHandler.fetch(request, {
          authInfo: { clientId: getCurrentUserId(), scopes: ["mcp"], token: "" },
        }),
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.reset();
    setCurrentUserId("user-1");
  });

  it("exposes the full tool set with read-only hints", async () => {
    const tools = await harness.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());

    const reads = tools.filter(
      (tool) =>
        tool.name !== "openstarter_create_ticket" && tool.name !== "openstarter_reply_ticket",
    );
    expect(reads.length).toBe(6);
    const write = tools.find((tool) => tool.name === "openstarter_create_ticket");
    expect(write?.description).toContain("support ticket");
  });

  it("get_profile returns the authenticated user's own profile", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1", email: "u1@test.dev", name: "User One" });
    await insertCredit(database, {
      id: "c1",
      transactionNo: "tn-1",
      userId: "user-1",
      credits: 100,
      remainingCredits: 40,
      transactionType: "grant",
    });

    const result = await harness.callTool("openstarter_get_profile");
    expect(result.isError).toBeFalsy();
    const profile = parseStructured(result) as {
      id: string;
      email: string;
      name: string;
      credits: number;
    };
    expect(profile.id).toBe("user-1");
    expect(profile.email).toBe("u1@test.dev");
    expect(profile.name).toBe("User One");
    expect(profile.credits).toBe(40);
  });

  it("list_orders returns only the caller's orders with pagination", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1" });
    await insertUser(database, { id: "user-2" });
    await insertOrder(database, {
      id: "o1",
      orderNo: "no-1",
      userId: "user-1",
      productName: "Pro Yearly",
    });
    await insertOrder(database, { id: "o2", orderNo: "no-2", userId: "user-2" });

    const result = await harness.callTool("openstarter_list_orders", { page: 1, pageSize: 20 });
    expect(result.isError).toBeFalsy();
    const payload = parseStructured(result) as {
      total: number;
      items: Array<{ productName?: string }>;
    };
    expect(payload.total).toBe(1);
    expect(payload.items[0]?.productName).toBe("Pro Yearly");
  });

  it("list_credit_history returns grant and consume entries", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1" });
    await insertCredit(database, {
      id: "c1",
      transactionNo: "tn-g",
      userId: "user-1",
      credits: 100,
      remainingCredits: 100,
      transactionType: "grant",
      description: "purchase",
    });
    await insertCredit(database, {
      id: "c2",
      transactionNo: "tn-c",
      userId: "user-1",
      credits: -20,
      remainingCredits: 80,
      transactionType: "consume",
    });

    const result = await harness.callTool("openstarter_list_credit_history", {
      limit: 10,
      offset: 0,
    });
    expect(result.isError).toBeFalsy();
    const payload = parseStructured(result) as { items: Array<{ credits: number }> };
    expect(payload.items).toHaveLength(2);
  });

  it("ticket write tools persist through the tickets service as role=user", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1" });

    const created = await harness.callTool("openstarter_create_ticket", {
      title: "Printer on fire",
      content: "It is literally on fire",
    });
    expect(created.isError).toBeFalsy();
    const ticketPayload = parseStructured(created) as { id: string; title: string };
    expect(ticketPayload.title).toBe("Printer on fire");

    const reply = await harness.callTool("openstarter_reply_ticket", {
      ticketId: ticketPayload.id,
      content: "Also the fan is broken",
    });
    expect(reply.isError).toBeFalsy();

    const database2 = getDatabase();
    const roles = await database2.all<{ role: string }>(
      sql`SELECT role FROM ticket_message WHERE ticket_id = ${ticketPayload.id}`,
    );
    expect(roles.every((row) => row.role === "user")).toBe(true);

    const thread = await harness.callTool("openstarter_get_ticket_messages", {
      ticketId: ticketPayload.id,
    });
    expect(thread.isError).toBeFalsy();
    const threadPayload = parseStructured(thread) as { items: Array<{ content: string }> };
    expect(threadPayload.items.map((item) => item.content)).toContain("Also the fan is broken");
  });

  it("get_ticket_messages rejects tickets owned by other users", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1" });
    await insertUser(database, { id: "user-2" });
    await database.run(sql`
      INSERT INTO ticket (id, user_id, title, status, created_at, updated_at)
      VALUES ('tk-other', 'user-2', 'foreign ticket', 'open', 1700000000000, 1700000000000)
    `);

    const result = await harness.callTool("openstarter_get_ticket_messages", {
      ticketId: "tk-other",
    });
    expect(result.isError).toBe(true);
  });

  it("reply_ticket rejects tickets owned by other users", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1" });
    await insertUser(database, { id: "user-2" });
    await database.run(sql`
      INSERT INTO ticket (id, user_id, title, status, created_at, updated_at)
      VALUES ('tk-other', 'user-2', 'foreign ticket', 'open', 1700000000000, 1700000000000)
    `);

    const result = await harness.callTool("openstarter_reply_ticket", {
      ticketId: "tk-other",
      content: "hijack",
    });
    expect(result.isError).toBe(true);
    const rows = await getDatabase().all<{ id: string }>(
      sql`SELECT id FROM ticket_message WHERE ticket_id = 'tk-other'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("invalid input surfaces as isError with an actionable message", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1" });

    const result = await harness.callTool("openstarter_create_ticket", { title: "", content: "" });
    expect(result.isError).toBe(true);
    const text = result.content.find((block) => block.type === "text")?.text ?? "";
    expect(text.toLowerCase()).toContain("title");
  });

  it("oversized pageSize is clamped by the schema", async () => {
    const database = getDatabase();
    await insertUser(database, { id: "user-1" });
    await insertOrder(database, { id: "o1", orderNo: "no-1", userId: "user-1" });

    const result = await harness.callTool("openstarter_list_orders", { page: 1, pageSize: 500 });
    expect(result.isError).toBe(true);
  });
});
