/**
 * LLM chat router — HTTP endpoints for conversation management and streaming.
 *
 * Endpoints:
 * - POST   /llm/chats           — Create new chat
 * - GET    /llm/chats           — List user's chats
 * - GET    /llm/chats/:id       — Get specific chat
 * - DELETE /llm/chats/:id       — Delete chat
 * - POST   /llm/chats/:id/messages  — Send message (SSE streaming)
 * - GET    /llm/chats/:id/messages  — Get chat messages
 */

import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respPage } from "@openstarter/shared";
import { streamText } from "ai";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/plan-gate";
import { paginationSchema } from "../../schema";

import { getModel, isLLMEnabled } from "./provider";
import {
  createChat,
  createMessage,
  deleteChat,
  getChat,
  getChatMessages,
  getMessageHistory,
  getUserChats,
  updateChat,
} from "./service";

const STATUS_NOT_FOUND = 404;
const STATUS_BAD_REQUEST = 400;
const STATUS_PROVIDER_ERROR = 502;

// ─── Validation Schemas ──────────────────────────────────────────────────

const createChatBody = z.object({
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

const sendMessageBody = z.object({
  content: z.string().min(1),
});

const listQuery = paginationSchema;

// ─── Router Setup ────────────────────────────────────────────────────────

export const llmRouter = new Hono()
  // GET /llm/chats — List user's chats
  .get(
    "/llm/chats",
    requireAuth,
    requirePlan("member"),
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize } = c.req.valid("query");
      const userId = c.get("userId") as string;

      const { items, total } = await getUserChats({
        userId,
        page,
        pageSize,
      });

      return c.json(respPage(items, total));
    },
  )
  // POST /llm/chats — Create new chat
  .post(
    "/llm/chats",
    requireAuth,
    requirePlan("member"),
    zValidator("json", createChatBody),
    async (c) => {
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;

      // Verify LLM is enabled
      const enabled = await isLLMEnabled();
      if (!enabled) {
        return c.json(respErr("LLM chat is not enabled"), STATUS_PROVIDER_ERROR);
      }

      // Verify model is available
      try {
        await getModel(body.provider, body.model);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json(respErr(message), STATUS_BAD_REQUEST);
      }

      const newChat = await createChat({
        userId,
        title: body.title,
        provider: body.provider,
        model: body.model,
      });

      return c.json(respData(newChat));
    },
  )
  // GET /llm/chats/:id — Get specific chat
  .get("/llm/chats/:id", requireAuth, requirePlan("member"), async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");

    const foundChat = await getChat({ id, userId });
    if (!foundChat) {
      return c.json(respErr("Chat not found"), STATUS_NOT_FOUND);
    }

    return c.json(respData(foundChat));
  })
  // DELETE /llm/chats/:id — Delete chat
  .delete("/llm/chats/:id", requireAuth, requirePlan("member"), async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");

    const foundChat = await getChat({ id, userId });
    if (!foundChat) {
      return c.json(respErr("Chat not found"), STATUS_NOT_FOUND);
    }

    await deleteChat({ id, userId });
    return c.json(respData(null));
  })
  // GET /llm/chats/:id/messages — Get chat message history
  .get(
    "/llm/chats/:id/messages",
    requireAuth,
    requirePlan("member"),
    zValidator("query", listQuery),
    async (c) => {
      const userId = c.get("userId") as string;
      const chatId = c.req.param("id");
      const { page, pageSize } = c.req.valid("query");

      // Verify chat exists and belongs to user
      const foundChat = await getChat({ id: chatId, userId });
      if (!foundChat) {
        return c.json(respErr("Chat not found"), STATUS_NOT_FOUND);
      }

      const { items, total } = await getChatMessages({
        chatId,
        userId,
        page,
        pageSize,
      });

      return c.json(respPage(items, total));
    },
  )
  // POST /llm/chats/:id/messages — Send message (SSE streaming)
  .post(
    "/llm/chats/:id/messages",
    requireAuth,
    requirePlan("member"),
    zValidator("json", sendMessageBody),
    async (c) => {
      const userId = c.get("userId") as string;
      const chatId = c.req.param("id");
      const { content } = c.req.valid("json");

      // Verify chat exists and belongs to user
      const foundChat = await getChat({ id: chatId, userId });
      if (!foundChat) {
        return c.json(respErr("Chat not found"), STATUS_NOT_FOUND);
      }

      // Save user message
      await createMessage({
        chatId,
        userId,
        role: "user",
        content,
        model: foundChat.model,
        provider: foundChat.provider,
      });

      // Get message history for context
      const history = await getMessageHistory({ chatId, userId });

      // Build messages array for AI SDK
      const messages = [...history, { role: "user" as const, content }];

      // Load the model
      let model;
      try {
        model = await getModel(foundChat.provider, foundChat.model);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json(respErr(message), STATUS_PROVIDER_ERROR);
      }

      try {
        // Stream the response via AI SDK with onFinish callback
        const result = streamText({
          model,
          messages,
          onFinish: async ({ text }) => {
            // Save assistant message after streaming completes
            if (text) {
              await createMessage({
                chatId,
                userId,
                role: "assistant",
                content: text,
                model: foundChat.model,
                provider: foundChat.provider,
              });

              // Auto-generate title from first user message
              if (history.length === 0) {
                const titlePreview = content.slice(0, 50);
                await updateChat({
                  id: chatId,
                  userId,
                  title: titlePreview,
                });
              }
            }
          },
        });

        // Return the AI SDK's built-in stream response (SSE)
        return result.toUIMessageStreamResponse();
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM error";
        return c.json(respErr(message), STATUS_PROVIDER_ERROR);
      }
    },
  );
