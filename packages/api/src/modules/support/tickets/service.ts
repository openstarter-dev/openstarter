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

import {
  TICKET_ROLE,
  TICKET_STATUS,
  type TicketRole,
  type TicketStatus,
} from "../../../schema/support/tickets";

const MAX_ATTACHMENTS = 9;
const MAX_ATTACHMENT_URL_LENGTH = 2048;
const HTTP_URL_PATTERN = /^https?:\/\//;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type CreateTicketParams = {
  userId: string;
  title: string;
  content: string;
  attachments?: string[];
};

export type AddMessageParams = {
  ticketId: string;
  userId: string;
  role: TicketRole;
  content: string;
  attachments?: string[];
};

export type TicketMessageView = Omit<TicketMessage, "attachments"> & {
  attachments: string[];
  userName: string | null;
  userAvatar: string | null;
};

export type UserTicketListItem = Ticket & { latestReply: string | null };

export type AdminTicketListItem = Ticket & {
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  latestReply: string | null;
};

export type ListUserTicketsParams = {
  userId: string;
  page?: number;
  pageSize?: number;
  status?: TicketStatus;
  search?: string;
};

export type ListUserTicketsResult = {
  items: UserTicketListItem[];
  total: number;
};

export type ListAllTicketsParams = {
  page?: number;
  pageSize?: number;
  status?: TicketStatus;
  search?: string;
};

export type ListAllTicketsResult = {
  items: AdminTicketListItem[];
  total: number;
};

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

export async function getTicketById(id: string): Promise<Ticket | undefined> {
  const [row] = await db().select().from(ticket).where(eq(ticket.id, id)).limit(1);
  return row;
}

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

export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
): Promise<Ticket | undefined> {
  await db().update(ticket).set({ status, updatedAt: new Date() }).where(eq(ticket.id, id));
  return getTicketById(id);
}

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
