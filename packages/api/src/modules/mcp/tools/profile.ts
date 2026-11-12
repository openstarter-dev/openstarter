// Profile-domain MCP tools: identity, subscription status, and credit ledger.
//
// All reads are scoped to the authenticated user resolved from the request
// context — tool arguments never influence whose data is returned.

import { getUserPlan } from "@openstarter/auth";
import { getBalance, getHistory, getSubscriptionStatusView } from "@openstarter/billing-web";
import { user as userTable } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";

import { creditHistoryQuerySchema } from "../../../schema/mcp";
import { jsonContent, resolveUserId, toIsoString, withToolError } from "../shared";

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

export function registerProfileTools(server: McpServer): void {
  server.registerTool(
    "openstarter_get_profile",
    {
      description:
        "Get the authenticated user's own profile: id, email, name, plan, and available credit balance. Use this first to learn who is connected.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    (_args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const [row] = await db()
          .select({
            createdAt: userTable.createdAt,
            email: userTable.email,
            id: userTable.id,
            name: userTable.name,
          })
          .from(userTable)
          .where(eq(userTable.id, userId))
          .limit(1);

        if (!row) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: `No profile exists for the authenticated user (${userId}). The API key may reference a deleted account.`,
              },
            ],
          };
        }

        const [plan, credits] = await Promise.all([getUserPlan(userId), getBalance(userId)]);

        return jsonContent({
          createdAt: toIsoString(row.createdAt),
          credits,
          email: row.email,
          id: row.id,
          name: row.name ?? "",
          plan: plan.plan,
          trialEndsAt: toIsoString(plan.trialEndsAt),
        });
      }),
  );

  server.registerTool(
    "openstarter_get_subscription",
    {
      description:
        "Get the authenticated user's subscription status: whether one exists, its state (active/pending_cancel/trialing…), plan name, and next billing date.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    (_args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const view = await getSubscriptionStatusView(userId);
        return jsonContent({
          hasSubscription: view.hasSubscription,
          nextBillingDate: toIsoString(view.nextBillingDate),
          planName: view.planName,
          status: view.status,
        });
      }),
  );

  server.registerTool(
    "openstarter_list_credit_history",
    {
      description:
        "List the authenticated user's credit transactions (grants and consumptions), newest first. Supports limit/offset paging; each entry shows credits, remaining credits, type, and description.",
      inputSchema: creditHistoryQuerySchema,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const entries = await getHistory(userId, { limit: args.limit, offset: args.offset });
        return jsonContent({
          items: entries.map((entry) => ({
            credits: entry.credits,
            createdAt: toIsoString(entry.createdAt),
            description: entry.description ?? null,
            expiresAt: toIsoString(entry.expiresAt),
            id: entry.id,
            remainingCredits: entry.remainingCredits,
            transactionNo: entry.transactionNo,
            transactionScene: entry.transactionScene ?? null,
            transactionType: entry.transactionType,
          })),
          limit: args.limit,
          offset: args.offset,
        });
      }),
  );
}
