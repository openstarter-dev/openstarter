// packages/api/src/schema/support/tickets —— tickets 域类型与入参校验
// （modules/support/tickets、modules/admin/tickets、modules/mcp/tools/tickets 复用）。
import { z } from "zod";

import { paginationSchema } from "../shared";

// ─── 域词汇表（as const，禁用 enum；service 与路由共享的单一事实源） ──────────

/** 工单状态：`open`（待管理员）/ `replied`（待用户）/ `closed`（已关闭）。 */
export const TICKET_STATUS = {
  OPEN: "open",
  REPLIED: "replied",
  CLOSED: "closed",
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

/** 工单消息发送方角色：`user`（用户）/ `admin`（管理员）。 */
export const TICKET_ROLE = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type TicketRole = (typeof TICKET_ROLE)[keyof typeof TICKET_ROLE];

/** 状态取值元组（非空 tuple），供路由层 `zValidator` 的 `z.enum` 复用。 */
export const TICKET_STATUS_VALUES = [
  TICKET_STATUS.OPEN,
  TICKET_STATUS.REPLIED,
  TICKET_STATUS.CLOSED,
] as const;

// ─── 长度上限（用户侧 / 管理侧 / MCP 工具共用） ────────────────────────────────

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 5000;

// ─── 入参校验（zValidator） ────────────────────────────────────────────────────

export const listQuery = paginationSchema.extend({
  status: z.enum(TICKET_STATUS_VALUES).optional(),
  keyword: z.string().min(1).optional(),
});

export const createBody = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(z.string()).optional(),
});

export const replyBody = z.object({
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(z.string()).optional(),
});
