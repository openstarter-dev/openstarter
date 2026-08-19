/**
 * LLM chat service — conversation and message persistence.
 *
 * Uses the existing `chat` / `chatMessage` tables. The `chatMessage` table
 * stores message payloads in its `parts` column (JSON array of content parts,
 * per the AI SDK convention); `chat.parts` holds the accumulated context.
 */

import { db } from "@openstarter/db/server";
import { chat, chatMessage } from "@openstarter/db/schema";
import { getUuid } from "@openstarter/shared/id";
import { and, desc, eq, sql } from "drizzle-orm";

const PAGE_SIZE = 20;

/** Serialize plain text into the AI SDK `parts` JSON format. */
function toParts(text: string): string {
  return JSON.stringify([{ type: "text", text }]);
}

/** Extract plain text from the AI SDK `parts` JSON format. */
function fromParts(parts: string | null | undefined): string {
  if (!parts) return "";
  try {
    const parsed = JSON.parse(parts) as Array<{ type?: string; text?: string }>;
    return parsed.map((p) => p.text ?? "").join("");
  } catch {
    return parts;
  }
}

/**
 * Create a new chat session.
 */
export async function createChat(args: {
  userId: string;
  title?: string;
  provider?: string;
  model?: string;
}): Promise<Record<string, unknown>> {
  const database = db();
  const chatId = getUuid();
  const now = new Date();

  await database.insert(chat).values({
    id: chatId,
    title: args.title || "New Chat",
    model: args.model || "gpt-4o-mini",
    provider: args.provider || "openai",
    status: "active",
    parts: toParts(""),
    userId: args.userId,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: chatId,
    title: args.title || "New Chat",
    model: args.model || "gpt-4o-mini",
    provider: args.provider || "openai",
    status: "active",
    userId: args.userId,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a specific chat (verify ownership).
 */
export async function getChat(args: {
  id: string;
  userId: string;
}): Promise<typeof chat.$inferSelect | null> {
  const database = db();
  const results = await database
    .select()
    .from(chat)
    .where(and(eq(chat.id, args.id), eq(chat.userId, args.userId)));

  return results[0] ?? null;
}

/**
 * List user's chats with pagination.
 */
export async function getUserChats(args: {
  userId: string;
  page: number;
  pageSize?: number;
}): Promise<{ items: (typeof chat.$inferSelect)[]; total: number }> {
  const database = db();
  const pageSize = args.pageSize || PAGE_SIZE;
  const offset = (args.page - 1) * pageSize;

  const [totalResult] = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(chat)
    .where(eq(chat.userId, args.userId));

  const items = await database
    .select()
    .from(chat)
    .where(eq(chat.userId, args.userId))
    .orderBy(desc(chat.updatedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items,
    total: Number(totalResult?.count) || 0,
  };
}

/**
 * Delete a chat and its messages (cascade delete).
 */
export async function deleteChat(args: { id: string; userId: string }): Promise<void> {
  const database = db();
  await database.delete(chat).where(and(eq(chat.id, args.id), eq(chat.userId, args.userId)));
}

/**
 * Update chat title and bump updatedAt.
 */
export async function updateChat(args: {
  id: string;
  userId: string;
  title?: string;
}): Promise<void> {
  const database = db();
  await database
    .update(chat)
    .set({
      ...(args.title !== undefined && { title: args.title }),
      updatedAt: new Date(),
    })
    .where(and(eq(chat.id, args.id), eq(chat.userId, args.userId)));
}

/**
 * Create a chat message (user or assistant).
 * Message payload is stored in the `parts` column (AI SDK JSON format).
 */
export async function createMessage(args: {
  chatId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
}): Promise<Record<string, unknown>> {
  const database = db();
  const messageId = getUuid();
  const now = new Date();

  await database.insert(chatMessage).values({
    id: messageId,
    chatId: args.chatId,
    role: args.role,
    parts: toParts(args.content),
    model: args.model || "",
    provider: args.provider || "",
    status: "success",
    userId: args.userId,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: messageId,
    chatId: args.chatId,
    role: args.role,
    content: args.content,
    model: args.model || "",
    provider: args.provider || "",
    status: "success",
    userId: args.userId,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get messages for a chat with pagination (newest first, reversed for display).
 */
export async function getChatMessages(args: {
  chatId: string;
  userId: string;
  page: number;
  pageSize?: number;
}): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const database = db();
  const pageSize = args.pageSize || PAGE_SIZE;
  const offset = (args.page - 1) * pageSize;

  const [totalResult] = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(chatMessage)
    .where(and(eq(chatMessage.chatId, args.chatId), eq(chatMessage.userId, args.userId)));

  const rows = await database
    .select()
    .from(chatMessage)
    .where(and(eq(chatMessage.chatId, args.chatId), eq(chatMessage.userId, args.userId)))
    .orderBy(desc(chatMessage.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = rows
    .map((m) => ({
      id: m.id,
      chatId: m.chatId,
      role: m.role,
      content: fromParts(m.parts),
      model: m.model,
      provider: m.provider,
      status: m.status,
      userId: m.userId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }))
    .reverse();

  return {
    items,
    total: Number(totalResult?.count) || 0,
  };
}

/**
 * Get chronological message history for AI SDK context assembly.
 */
export async function getMessageHistory(args: {
  chatId: string;
  userId: string;
}): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const database = db();
  const rows = await database
    .select()
    .from(chatMessage)
    .where(and(eq(chatMessage.chatId, args.chatId), eq(chatMessage.userId, args.userId)))
    .orderBy(chatMessage.createdAt);

  return rows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: fromParts(m.parts),
  }));
}
