import type { McpServer } from "@modelcontextprotocol/server";

import { getTasks } from "../../ai/tasks/service";
import { listUserOrders } from "../../user/service";
import { listAiTasksSchema, mcpPaginationSchema } from "../../../schema/mcp";
import { jsonContent, resolveUserId, toIsoString, withToolError } from "../shared";

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

export function registerCommerceTools(server: McpServer): void {
  server.registerTool(
    "openstarter_list_orders",
    {
      description:
        "List the authenticated user's orders (payment records), newest first, with page/pageSize pagination. Each entry includes order number, product, amount, currency, and status.",
      inputSchema: mcpPaginationSchema,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const { items, total } = await listUserOrders({
          userId,
          page: args.page,
          pageSize: args.pageSize,
        });
        return jsonContent({
          items: items.map((item) => ({
            amount: item.amount,
            createdAt: toIsoString(item.createdAt),
            currency: item.currency,
            orderNo: item.orderNo,
            paymentProvider: item.paymentProvider,
            productName: item.productName,
            status: item.status,
          })),
          page: args.page,
          pageSize: args.pageSize,
          total,
        });
      }),
  );

  server.registerTool(
    "openstarter_list_ai_tasks",
    {
      description:
        "List the authenticated user's AI generation tasks, newest first, with optional mediaType/status filters and pagination. Each entry includes prompt, model, status, and cost in credits.",
      inputSchema: listAiTasksSchema,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const { items, total } = await getTasks({
          mediaType: args.mediaType,
          page: args.page,
          pageSize: args.pageSize,
          status: args.status,
          userId,
        });
        return jsonContent({
          items: items.map((item) => ({
            costCredits: item.costCredits,
            createdAt: toIsoString(item.createdAt),
            id: item.id,
            mediaType: item.mediaType,
            model: item.model,
            prompt: item.prompt,
            provider: item.provider,
            status: item.status,
          })),
          page: args.page,
          pageSize: args.pageSize,
          total,
        });
      }),
  );
}
