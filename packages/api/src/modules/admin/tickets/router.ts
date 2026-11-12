import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respPage } from "@openstarter/shared";
import { Hono } from "hono";

import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";
import { idParam } from "../../../schema";
import { listQuery, replyBody, statusBody } from "../../../schema/admin/tickets";
import { TICKET_ROLE } from "../../../schema/support/tickets";
import {
  addMessage,
  getTicketById,
  getTicketMessages,
  listAllTickets,
  sanitizeAttachments,
  updateTicketStatus,
} from "../../support/tickets";

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

const PERMISSION_READ = "ticket.read";
const PERMISSION_REPLY = "ticket.reply";
const PERMISSION_UPDATE = "ticket.update";

export const adminTicketsRouter = new Hono()
  .use(requireAuth)
  .get("/", requirePermission(PERMISSION_READ), zValidator("query", listQuery), async (c) => {
    const { page, pageSize, status, keyword } = c.req.valid("query");
    const { items, total } = await listAllTickets({
      page,
      pageSize,
      status,
      search: keyword,
    });
    return c.json(respPage(items, total));
  })
  .get("/:id", requirePermission(PERMISSION_READ), zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const found = await getTicketById(id);
    if (!found) {
      return c.json(respErr("ticket not found"), NOT_FOUND_STATUS);
    }
    const messages = await getTicketMessages(id);
    return c.json(respData({ ticket: found, messages }));
  })
  .post(
    "/:id/messages",
    requirePermission(PERMISSION_REPLY),
    zValidator("param", idParam),
    zValidator("json", replyBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");

      const found = await getTicketById(id);
      if (!found) {
        return c.json(respErr("ticket not found"), NOT_FOUND_STATUS);
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
        userId: c.get("userId"),
        role: TICKET_ROLE.ADMIN,
        content,
        attachments,
      });
      return c.json(respData(message));
    },
  )
  .patch(
    "/:id/status",
    requirePermission(PERMISSION_UPDATE),
    zValidator("param", idParam),
    zValidator("json", statusBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");

      const found = await getTicketById(id);
      if (!found) {
        return c.json(respErr("ticket not found"), NOT_FOUND_STATUS);
      }

      const updated = await updateTicketStatus(id, status);
      return c.json(respData(updated));
    },
  );
