import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../../middleware/auth";
import { idParam, paginationSchema } from "../../../schema";
import {
  addMessage,
  createTicket,
  getTicketById,
  getTicketMessages,
  listUserTickets,
  sanitizeAttachments,
  TICKET_ROLE,
  TICKET_STATUS,
  TICKET_STATUS_VALUES,
} from "./index";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

const listQuery = paginationSchema.extend({
  status: z.enum(TICKET_STATUS_VALUES).optional(),
  keyword: z.string().min(1).optional(),
});

const createBody = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(z.string()).optional(),
});

const replyBody = z.object({
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(z.string()).optional(),
});

export const ticketsRouter = new Hono()
  .post("/", requireAuth, zValidator("json", createBody), async (c) => {
    const body = c.req.valid("json");
    const title = body.title.trim();
    const content = body.content.trim();
    if (title === "" || content === "") {
      return c.json(
        respErr("title and content are required"),
        BAD_REQUEST_STATUS
      );
    }

    const attachments = sanitizeAttachments(body.attachments);
    if (attachments === null) {
      return c.json(respErr("invalid attachments"), BAD_REQUEST_STATUS);
    }

    const created = await createTicket({
      userId: c.get("userId"),
      title,
      content,
      attachments,
    });
    return c.json(respData(created));
  })
  .get("/", requireAuth, zValidator("query", listQuery), async (c) => {
    const { page, pageSize, status, keyword } = c.req.valid("query");
    const { items, total } = await listUserTickets({
      userId: c.get("userId"),
      page,
      pageSize,
      status,
      search: keyword,
    });
    return c.json(respPage(items, total));
  })
  .get("/:id", requireAuth, zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const owned = await getTicketById(id);
    if (!owned || owned.userId !== c.get("userId")) {
      return c.json(respErr("ticket not found"), NOT_FOUND_STATUS);
    }
    const messages = await getTicketMessages(id);
    return c.json(respData({ ticket: owned, messages }));
  })
  .post("/:id/messages", requireAuth, zValidator("param", idParam), zValidator("json", replyBody), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const userId = c.get("userId");

    const owned = await getTicketById(id);
    if (!owned || owned.userId !== userId) {
      return c.json(respErr("ticket not found"), NOT_FOUND_STATUS);
    }
    if (owned.status === TICKET_STATUS.CLOSED) {
      return c.json(respErr("ticket is closed"), BAD_REQUEST_STATUS);
    }

    const content = body.content.trim();
    if (content === "") {
      return c.json(respErr("content is required"), BAD_REQUEST_STATUS);
    }
    const attachments = sanitizeAttachments(body.attachments);
    if (attachments === null) {
      return c.json(respErr("invalid attachments"), BAD_REQUEST_STATUS);
    }

    const message = await addMessage({
      ticketId: id,
      userId,
      role: TICKET_ROLE.USER,
      content,
      attachments,
    });
    return c.json(respData(message));
  });