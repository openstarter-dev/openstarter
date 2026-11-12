// packages/api/src/schema/mcp —— MCP 工具入参校验（modules/mcp/tools/* 复用）。
//
// 与 HTTP 路由 schema 的差异：MCP 工具入参经 SDK 反序列化已是原生 JSON 类型，
// 分页用 z.number()（非 z.coerce），并带面向模型的 .describe() 说明。
import { z } from "zod";

import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, TICKET_STATUS_VALUES } from "./support/tickets";

/** Pagination defaults aligned with `createPaginationSchema` semantics. */
export const MCP_MAX_PAGE_SIZE = 100;
export const MCP_DEFAULT_PAGE_SIZE = 20;

export const mcpPaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MCP_MAX_PAGE_SIZE).default(MCP_DEFAULT_PAGE_SIZE),
});

export const creditHistoryQuerySchema = z.object({
  limit: z.number().int().min(1).max(MCP_MAX_PAGE_SIZE).default(MCP_DEFAULT_PAGE_SIZE),
  offset: z.number().int().min(0).default(0),
});

// ─── orders（openstarter_list_orders / openstarter_list_ai_tasks） ────────────

const AI_TASK_STATUSES = ["pending", "processing", "success", "failed", "canceled"] as const;

export const listAiTasksSchema = mcpPaginationSchema.extend({
  mediaType: z
    .string()
    .min(1)
    .max(50)
    .optional()
    .describe("Filter by media type, e.g. 'image' or 'music'."),
  status: z.enum(AI_TASK_STATUSES).optional().describe("Filter by task status."),
});

// ─── chats（openstarter_list_chats / openstarter_get_chat_messages） ──────────

export const getChatMessagesSchema = mcpPaginationSchema.extend({
  chatId: z
    .string()
    .min(1)
    .describe("Id of the chat whose messages to read (from openstarter_list_chats)."),
});

// ─── tickets（工单读写工具） ──────────────────────────────────────────────────

export const listTicketsSchema = mcpPaginationSchema.extend({
  status: z.enum(TICKET_STATUS_VALUES).optional().describe("Filter by ticket status."),
  search: z.string().min(1).max(200).optional().describe("Search within ticket titles."),
});

export const createTicketSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH).describe("Short summary of the issue."),
  content: z
    .string()
    .min(1)
    .max(MAX_CONTENT_LENGTH)
    .describe("Full description of the issue; posted as the first message."),
});

export const ticketIdSchema = z.object({
  ticketId: z.string().min(1).describe("Id of the ticket (from openstarter_list_tickets)."),
});

export const replyTicketSchema = ticketIdSchema.extend({
  content: z
    .string()
    .min(1)
    .max(MAX_CONTENT_LENGTH)
    .describe("Reply content; appended to the ticket thread."),
});
