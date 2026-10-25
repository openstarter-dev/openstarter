// Chat MCP tools: read-only access to the caller's LLM conversations.

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getChat, getChatMessages, getUserChats } from "../../ai/llm/service";
import {
  jsonContent,
  paginationSchema,
  resolveUserId,
  toIsoString,
  withToolError,
} from "../shared";

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

const getChatMessagesSchema = paginationSchema.extend({
  chatId: z
    .string()
    .min(1)
    .describe("Id of the chat whose messages to read (from openstarter_list_chats)."),
});

export function registerChatTools(server: McpServer): void {
  server.registerTool(
    "openstarter_list_chats",
    {
      description:
        "List the authenticated user's LLM chat conversations, most recently updated first, with pagination. Each entry includes id, title, model, and status.",
      inputSchema: paginationSchema,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const { items, total } = await getUserChats({
          page: args.page,
          pageSize: args.pageSize,
          userId,
        });
        return jsonContent({
          items: items.map((item) => ({
            createdAt: toIsoString(item.createdAt),
            id: item.id,
            model: item.model,
            provider: item.provider,
            status: item.status,
            title: item.title,
            updatedAt: toIsoString(item.updatedAt),
          })),
          page: args.page,
          pageSize: args.pageSize,
          total,
        });
      }),
  );

  server.registerTool(
    "openstarter_get_chat_messages",
    {
      description:
        "Read the messages of one of the authenticated user's chats, oldest first, with pagination. Content is flattened to plain text per message.",
      inputSchema: getChatMessagesSchema,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const chat = await getChat({ id: args.chatId, userId });
        if (!chat) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: `Chat ${args.chatId} was not found for this account. Call openstarter_list_chats to get valid chat ids.`,
              },
            ],
          };
        }

        const { items, total } = await getChatMessages({
          chatId: args.chatId,
          page: args.page,
          pageSize: args.pageSize,
          userId,
        });
        return jsonContent({
          chatId: args.chatId,
          items: items.map((item) => ({
            content: item.content,
            createdAt: toIsoString(item.createdAt as unknown as Date),
            id: item.id,
            model: item.model,
            role: item.role,
          })),
          page: args.page,
          pageSize: args.pageSize,
          total,
        });
      }),
  );
}
