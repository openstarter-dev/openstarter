import { z } from "zod";

import { paginationSchema } from "../shared";
import { MAX_CONTENT_LENGTH, TICKET_STATUS_VALUES } from "../support/tickets";

export const listQuery = paginationSchema.extend({
  status: z.enum(TICKET_STATUS_VALUES).optional(),
  keyword: z.string().min(1).optional(),
});

export const replyBody = z.object({
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(z.string()).optional(),
});

export const statusBody = z.object({
  status: z.enum(TICKET_STATUS_VALUES),
});
