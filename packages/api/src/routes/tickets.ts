// packages/api/src/routes/tickets —— 工单客服路由（R21.1/R21.2/R21.3/R21.5/R21.6）。
//
// 分为「用户路由」与「管理员路由」两组，鉴权与权限分别施加（任务 28.3）：
//   用户路由（挂 `requireAuth`：会话或有效 API Key，读 `c.var.userId`）——
//     - POST   /api/tickets                创建工单（R21.1）；
//     - GET    /api/tickets                我的工单（仅本人，R21.6）；
//     - GET    /api/tickets/:id            本人工单详情 + 消息线程（访问隔离，R21.6）；
//     - POST   /api/tickets/:id/messages   回复本人工单（角色 user → 工单转 open，R21.3）。
//   管理员路由（挂 `requireAuth` + `requirePermission(ticket.*)`：平台级授权仅由通配符 RBAC
//   判定，与 organization 解耦）——
//     - GET    /api/admin/tickets              列出全部工单（R21.6）；
//     - GET    /api/admin/tickets/:id          任意工单详情 + 消息线程；
//     - POST   /api/admin/tickets/:id/messages 回复任意工单（角色 admin → 工单转 replied，R21.2）；
//     - PATCH  /api/admin/tickets/:id/status   改状态（关闭 → closed，R21.5）。
//
// 访问隔离（R21.6）：普通用户对**非本人**工单一律不可读写——先 `getTicketById` 再校验
// `ticket.userId === c.var.userId`，找不到或非本人归属即返回 404（不泄露存在性）。管理员访问全部
// 工单的资格由 `requirePermission("ticket.read"/"ticket.reply"/"ticket.update")` 判定，授予
// `ticket.*` 或 `*` 即通行（通配符 RBAC）。
//
// 附件（R21.4）：入参 `attachments` 为 storage 上传端点（POST /api/storage/upload-image，任务 22）
// 已持久化到对象存储后回传的可访问 URL；此处经 `sanitizeAttachments` 在存储前完成安全校验
// （数量 ≤9 / 每条 ≤2048 / 仅相对路径或 http(s)），不合规返回 400。入参经 `zValidator` 校验。

import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import {
  addMessage,
  createTicket,
  getTicketById,
  getTicketMessages,
  listAllTickets,
  listUserTickets,
  sanitizeAttachments,
  TICKET_ROLE,
  TICKET_STATUS,
  TICKET_STATUS_VALUES,
  updateTicketStatus,
} from "../tickets";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

// 权限码（`resource.action`）。通配符 RBAC 约定：授予 `ticket.*` 或 `*` 即通行——
// 即「工单管理权限」（R21.6）。列表/详情读用 read，回复用 reply，改状态用 update。
const PERMISSION_READ = "ticket.read";
const PERMISSION_REPLY = "ticket.reply";
const PERMISSION_UPDATE = "ticket.update";

// ─── 入参校验 schema（zValidator） ───────────────────────────────────────────

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  status: z.enum(TICKET_STATUS_VALUES).optional(),
  keyword: z.string().min(1).optional(),
});

const idParam = z.object({ id: z.string().min(1) });

const createBody = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(z.string()).optional(),
});

const replyBody = z.object({
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(z.string()).optional(),
});

const statusBody = z.object({
  status: z.enum(TICKET_STATUS_VALUES),
});

export const ticketsRoute = new Hono()
  // ── 用户路由（requireAuth） ────────────────────────────────────────────────
  .post(
    "/api/tickets",
    requireAuth,
    zValidator("json", createBody),
    async (c) => {
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
    }
  )
  .get("/api/tickets", requireAuth, zValidator("query", listQuery), async (c) => {
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
  .get(
    "/api/tickets/:id",
    requireAuth,
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      const owned = await getTicketById(id);
      // 访问隔离：不存在或非本人归属 → 404（不泄露存在性，R21.6）。
      if (!owned || owned.userId !== c.get("userId")) {
        return c.json(respErr("ticket not found"), NOT_FOUND_STATUS);
      }
      const messages = await getTicketMessages(id);
      return c.json(respData({ ticket: owned, messages }));
    }
  )
  .post(
    "/api/tickets/:id/messages",
    requireAuth,
    zValidator("param", idParam),
    zValidator("json", replyBody),
    async (c) => {
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
    }
  )
  // ── 管理员路由（requireAuth + requirePermission，通配符 RBAC） ────────────────
  .get(
    "/api/admin/tickets",
    requireAuth,
    requirePermission(PERMISSION_READ),
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize, status, keyword } = c.req.valid("query");
      const { items, total } = await listAllTickets({
        page,
        pageSize,
        status,
        search: keyword,
      });
      return c.json(respPage(items, total));
    }
  )
  .get(
    "/api/admin/tickets/:id",
    requireAuth,
    requirePermission(PERMISSION_READ),
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      const found = await getTicketById(id);
      if (!found) {
        return c.json(respErr("ticket not found"), NOT_FOUND_STATUS);
      }
      const messages = await getTicketMessages(id);
      return c.json(respData({ ticket: found, messages }));
    }
  )
  .post(
    "/api/admin/tickets/:id/messages",
    requireAuth,
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
    }
  )
  .patch(
    "/api/admin/tickets/:id/status",
    requireAuth,
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
    }
  );
