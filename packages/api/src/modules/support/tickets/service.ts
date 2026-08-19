// packages/api/src/tickets/service —— 工单客服服务（Ticket_Service，R21）。
//
// 对齐 ShipAny `modules/tickets/service.ts`，落位于 `packages/api/tickets`（design：
// modules/tickets → packages/api/tickets）。提供工单（ticket）与工单消息（ticket_message）的
// 创建 / 回复 / 状态迁移 / 分页查询，并对用户提交的附件 URL 做安全校验（sanitizeAttachments）。
//
// 状态迁移（R21.2 / R21.3 / R21.5）：
//   - createTicket：事务内建 `ticket`（初始 `open`）+ 首条 `user` 消息，关联用户（R21.1）。
//   - addMessage：admin 回复 → 工单转 `replied`（R21.2，等待用户）；user 回复 → 转 `open`
//     （R21.3，等待管理员）。
//   - updateTicketStatus：改状态（关闭 → `closed`，R21.5）。
//
// 附件与访问隔离（R21.4 / R21.6）：
//   - 附件为**已上传**到对象存储后回传的可访问 URL——上传由 storage 域的上传端点
//     （`POST /api/storage/upload-image`，任务 22：持久化到对象存储，无渠道走 base64 内联兜底，
//     R18.3）完成；本服务只对这些 URL 做安全校验（sanitizeAttachments）并存入消息，从而「经
//     Storage_Service 存储附件并在消息中保存其可访问 URL」（R21.4）。校验必须在存储前完成。
//   - 访问隔离由路由层施加：普通用户仅能读写**本人**工单（否则 404），具「工单管理」通配符权限
//     的管理员可访问全部（R21.6）；本服务的读取函数按调用方语义（本人 / 全部）分列。
//
// 数据访问统一走 `@openstarter/db`（`db()` 单例 + `@openstarter/db/schema` 表定义），跨方言一致：
// 写入不依赖 MySQL 缺失的 `.returning()`，而是「插入后按 id 回读」返回完整记录；建单（工单 +
// 首条消息）与回复（消息 + 状态迁移）经 `db().transaction` 在**单事务**内原子完成。

import {
  type Ticket,
  ticket,
  type TicketMessage,
  ticketMessage,
  user,
} from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";

// ─── 常量与取值（Constants / enums as const，禁用 TS enum） ───────────────────

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

// 附件校验上限（R21.4）：最多 9 条、每条 URL 最长 2048 字符。
const MAX_ATTACHMENTS = 9;
const MAX_ATTACHMENT_URL_LENGTH = 2048;
// 仅允许相对路径（`/` 开头）或 http(s) 绝对 URL；正则在顶层声明（避免重复构造）。
const HTTP_URL_PATTERN = /^https?:\/\//;

// 分页默认与上限。
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─── 类型（Params / Views / Results） ────────────────────────────────────────

/** 创建工单入参。`attachments` 为已校验通过的附件 URL 数组（缺省空）。 */
export type CreateTicketParams = {
  userId: string;
  title: string;
  content: string;
  attachments?: string[];
};

/** 追加消息入参。`role` 决定状态迁移（admin→replied / user→open）。 */
export type AddMessageParams = {
  ticketId: string;
  userId: string;
  role: TicketRole;
  content: string;
  attachments?: string[];
};

/** 工单消息视图：`attachments` JSON 列解析为 URL 数组，并附发送人展示信息。 */
export type TicketMessageView = Omit<TicketMessage, "attachments"> & {
  attachments: string[];
  userName: string | null;
  userAvatar: string | null;
};

/** 用户工单列表项：工单本体 + 最近一条管理员回复预览（无则 null）。 */
export type UserTicketListItem = Ticket & { latestReply: string | null };

/** 管理员工单列表项：工单本体 + 提交人信息 + 最近管理员回复预览。 */
export type AdminTicketListItem = Ticket & {
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  latestReply: string | null;
};

/** 用户工单列表筛选入参（仅本人）。 */
export type ListUserTicketsParams = {
  userId: string;
  page?: number;
  pageSize?: number;
  status?: TicketStatus;
  search?: string;
};

/** 用户工单列表返回：条目与总数（与 `respPage` 结构一致）。 */
export type ListUserTicketsResult = {
  items: UserTicketListItem[];
  total: number;
};

/** 管理员工单列表筛选入参（全部工单）。 */
export type ListAllTicketsParams = {
  page?: number;
  pageSize?: number;
  status?: TicketStatus;
  search?: string;
};

/** 管理员工单列表返回：条目与总数。 */
export type ListAllTicketsResult = {
  items: AdminTicketListItem[];
  total: number;
};

// ─── 附件安全校验（Sanitize，R21.4） ─────────────────────────────────────────

/**
 * 校验用户提交的附件 URL 列表（R21.4，存储前完成）：
 *   - 未提供（`undefined`/`null`）→ 视为空数组；
 *   - 必须为数组且长度 ≤ {@link MAX_ATTACHMENTS}（9 条）；
 *   - 每项须为非空字符串、原始长度 ≤ {@link MAX_ATTACHMENT_URL_LENGTH}（2048）、
 *     且为相对路径（`/` 开头）或 http(s) 绝对 URL。
 * 任一不合规返回 `null`（供路由层转 400）；合规返回**去空白**后的 URL 数组。
 */
export function sanitizeAttachments(input: unknown): string[] | null {
  if (input === undefined || input === null) {
    return [];
  }
  if (!Array.isArray(input)) {
    return null;
  }
  if (input.length > MAX_ATTACHMENTS) {
    return null;
  }

  const urls: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") {
      return null;
    }
    const url = item.trim();
    if (url === "" || item.length > MAX_ATTACHMENT_URL_LENGTH) {
      return null;
    }
    if (!(url.startsWith("/") || HTTP_URL_PATTERN.test(url))) {
      return null;
    }
    urls.push(url);
  }
  return urls;
}

/** 解析消息 `attachments` JSON 列为字符串 URL 数组；非法/为空时返回空数组。 */
function parseAttachments(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

// ─── 读取（Read，R21.6 访问隔离由路由层施加） ─────────────────────────────────

/** 按 id 读取单条工单；不存在返回 `undefined`。所有权校验由路由层负责（R21.6）。 */
export async function getTicketById(id: string): Promise<Ticket | undefined> {
  const [row] = await db().select().from(ticket).where(eq(ticket.id, id)).limit(1);
  return row;
}

/** 读取工单的消息线程（按时间升序），附发送人名称与头像。 */
export async function getTicketMessages(ticketId: string): Promise<TicketMessageView[]> {
  const rows = await db()
    .select({
      id: ticketMessage.id,
      ticketId: ticketMessage.ticketId,
      userId: ticketMessage.userId,
      role: ticketMessage.role,
      content: ticketMessage.content,
      attachments: ticketMessage.attachments,
      createdAt: ticketMessage.createdAt,
      userName: user.name,
      userAvatar: user.image,
    })
    .from(ticketMessage)
    .leftJoin(user, eq(ticketMessage.userId, user.id))
    .where(eq(ticketMessage.ticketId, ticketId))
    .orderBy(asc(ticketMessage.createdAt));

  return rows.map((row) => ({
    ...row,
    attachments: parseAttachments(row.attachments),
  }));
}

/**
 * 批量取每个工单的**最近一条**管理员回复（用于列表预览）。整页工单一次查询，
 * 按创建时间倒序扫描，每个工单保留首次遇到（即最新）的回复内容。
 */
async function getLatestAdminReplies(ticketIds: string[]): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  if (ticketIds.length === 0) {
    return latest;
  }

  const rows = await db()
    .select({
      ticketId: ticketMessage.ticketId,
      content: ticketMessage.content,
    })
    .from(ticketMessage)
    .where(
      and(inArray(ticketMessage.ticketId, ticketIds), eq(ticketMessage.role, TICKET_ROLE.ADMIN)),
    )
    .orderBy(desc(ticketMessage.createdAt));

  for (const row of rows) {
    if (!latest.has(row.ticketId)) {
      latest.set(row.ticketId, row.content);
    }
  }
  return latest;
}

// ─── 创建工单 + 首条消息（Create，R21.1） ────────────────────────────────────

/**
 * 创建工单并写入首条用户消息（R21.1），在**单事务**内原子完成：
 *   1. 插入 `ticket`（初始状态 `open`），关联用户；
 *   2. 插入首条 `ticket_message`（角色 `user`，携带已校验附件 URL）；
 *   3. 按 id 回读返回完整工单记录（跨方言一致，不依赖 MySQL 缺失的 `.returning()`）。
 */
export function createTicket(params: CreateTicketParams): Promise<Ticket> {
  const ticketId = getUuid();
  const now = new Date();

  return db().transaction(async (tx) => {
    await tx.insert(ticket).values({
      id: ticketId,
      userId: params.userId,
      title: params.title,
      status: TICKET_STATUS.OPEN,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(ticketMessage).values({
      id: getUuid(),
      ticketId,
      userId: params.userId,
      role: TICKET_ROLE.USER,
      content: params.content,
      attachments: JSON.stringify(params.attachments ?? []),
      createdAt: now,
    });

    const [created] = await tx.select().from(ticket).where(eq(ticket.id, ticketId)).limit(1);
    if (!created) {
      throw new Error("Failed to load ticket after creation");
    }
    return created;
  });
}

// ─── 追加消息 + 状态迁移（Add message，R21.2 / R21.3） ────────────────────────

/**
 * 向工单追加一条消息并按发送方角色迁移状态（R21.2/R21.3），在**单事务**内原子完成：
 *   - admin 回复 → 工单转 `replied`（等待用户）；
 *   - user 回复 → 工单转 `open`（等待管理员）。
 * 插入后按 id 回读返回完整消息记录（跨方言一致）。
 */
export function addMessage(params: AddMessageParams): Promise<TicketMessage> {
  const messageId = getUuid();
  const now = new Date();
  const nextStatus = params.role === TICKET_ROLE.ADMIN ? TICKET_STATUS.REPLIED : TICKET_STATUS.OPEN;

  return db().transaction(async (tx) => {
    await tx.insert(ticketMessage).values({
      id: messageId,
      ticketId: params.ticketId,
      userId: params.userId,
      role: params.role,
      content: params.content,
      attachments: JSON.stringify(params.attachments ?? []),
      createdAt: now,
    });

    await tx
      .update(ticket)
      .set({ status: nextStatus, updatedAt: now })
      .where(eq(ticket.id, params.ticketId));

    const [created] = await tx
      .select()
      .from(ticketMessage)
      .where(eq(ticketMessage.id, messageId))
      .limit(1);
    if (!created) {
      throw new Error("Failed to load ticket message after creation");
    }
    return created;
  });
}

// ─── 状态更新（Update status，R21.5） ────────────────────────────────────────

/**
 * 更新工单状态（R21.5，关闭 → `closed`；亦支持 `open`/`replied` 复用），并刷新 `updatedAt`。
 * 更新后按 id 回读返回完整记录；记录不存在返回 `undefined`。
 */
export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
): Promise<Ticket | undefined> {
  await db().update(ticket).set({ status, updatedAt: new Date() }).where(eq(ticket.id, id));
  return getTicketById(id);
}

// ─── 分页查询（List） ─────────────────────────────────────────────────────────

/**
 * 分页列出**当前用户本人**的工单（R21.6 访问隔离）：可选按状态筛选、按标题模糊搜索，
 * 按最近活动（`updatedAt`）倒序，并附每单最近一条管理员回复预览。
 */
export async function listUserTickets(
  params: ListUserTicketsParams,
): Promise<ListUserTicketsResult> {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const conditions: SQL[] = [eq(ticket.userId, params.userId)];
  if (params.status) {
    conditions.push(eq(ticket.status, params.status));
  }
  if (params.search) {
    conditions.push(like(ticket.title, `%${params.search}%`));
  }
  const where = and(...conditions);

  const [totalRow] = await db().select({ value: count() }).from(ticket).where(where);

  const rows = await db()
    .select()
    .from(ticket)
    .where(where)
    .orderBy(desc(ticket.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const replies = await getLatestAdminReplies(rows.map((row) => row.id));
  const items = rows.map((row) => ({
    ...row,
    latestReply: replies.get(row.id) ?? null,
  }));

  return { items, total: totalRow?.value ?? 0 };
}

/**
 * 分页列出**全部**工单（R21.6，供具工单管理权限的管理员使用）：可选按状态筛选、
 * 按标题 / 提交人邮箱 / 提交人姓名模糊搜索，按最近活动倒序，并附提交人信息与最近回复预览。
 */
export async function listAllTickets(params: ListAllTicketsParams): Promise<ListAllTicketsResult> {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const conditions: SQL[] = [];
  if (params.status) {
    conditions.push(eq(ticket.status, params.status));
  }
  if (params.search) {
    const term = `%${params.search}%`;
    const searchCondition = or(
      like(ticket.title, term),
      like(user.email, term),
      like(user.name, term),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db()
    .select({ value: count() })
    .from(ticket)
    .leftJoin(user, eq(ticket.userId, user.id))
    .where(where);

  const rows = await db()
    .select({
      id: ticket.id,
      userId: ticket.userId,
      title: ticket.title,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      userName: user.name,
      userEmail: user.email,
      userAvatar: user.image,
    })
    .from(ticket)
    .leftJoin(user, eq(ticket.userId, user.id))
    .where(where)
    .orderBy(desc(ticket.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const replies = await getLatestAdminReplies(rows.map((row) => row.id));
  const items = rows.map((row) => ({
    ...row,
    latestReply: replies.get(row.id) ?? null,
  }));

  return { items, total: totalRow?.value ?? 0 };
}
