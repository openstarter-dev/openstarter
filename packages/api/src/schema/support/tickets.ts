import { z } from "zod";

import { paginationSchema } from "../shared";

export const TICKET_STATUS = {
  OPEN: "open",
  REPLIED: "replied",
  CLOSED: "closed",
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const TICKET_ROLE = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type TicketRole = (typeof TICKET_ROLE)[keyof typeof TICKET_ROLE];

export const TICKET_STATUS_VALUES = [
  TICKET_STATUS.OPEN,
  TICKET_STATUS.REPLIED,
  TICKET_STATUS.CLOSED,
] as const;


export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 5000;


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
