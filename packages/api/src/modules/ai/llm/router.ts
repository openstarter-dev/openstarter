import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { respData, respErr, respPage } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";

import { zValidator } from "../../../lib/validator";
import { requireAuth } from "../../../middleware/auth";
import { requirePlan } from "../../../middleware/plan-gate";
import { paginationSchema } from "../../../schema";
import { createChatBody, sendMessageBody } from "../../../schema/ai/llm";

import { revoke } from "@openstarter/billing-web";
import { InsufficientCreditsError } from "../tasks/service";
import { extractLatestUserText } from "./agui-body";
import { createBillingMiddleware } from "./billing-middleware";
import { preloadChatCredits, settleChatCredits } from "./credits";
import { getAdapter, isLLMEnabled } from "./provider";
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
const STATUS_INSUFFICIENT_CREDITS = 402;

export const llmRouter = new Hono()
  // GET /llm/chats — List user's chats
  .get(
    "/llm/chats",
    requireAuth,
    requirePlan("member"),
    zValidator("query", paginationSchema),
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

      const enabled = await isLLMEnabled();
      if (!enabled) {
        return c.json(respErr("LLM chat is not enabled"), STATUS_PROVIDER_ERROR);
      }

      try {
        await getAdapter(body.provider, body.model);
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
    zValidator("query", paginationSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const chatId = c.req.param("id");
      const { page, pageSize } = c.req.valid("query");

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
      const body = c.req.valid("json");
      const content = extractLatestUserText(body);
      if (content === null) {
        return c.json(respErr("no user message to send"), STATUS_BAD_REQUEST);
      }
      if (body.threadId !== undefined && body.threadId !== chatId) {
        return c.json(respErr("threadId mismatch"), STATUS_BAD_REQUEST);
      }

      const foundChat = await getChat({ id: chatId, userId });
      if (!foundChat) {
        return c.json(respErr("Chat not found"), STATUS_NOT_FOUND);
      }

      const { messages: history, totalChars } = await getMessageHistory({ chatId, userId });

      let preload: {
        consumedCreditId: string | null;
        estimatedCost: number;
        maxOutputTokens: number | null;
      };
      try {
        preload = await preloadChatCredits({
          userId,
          chatId,
          provider: foundChat.provider,
          model: foundChat.model,
          historyChars: totalChars,
        });
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return c.json(respErr("insufficient credits"), STATUS_INSUFFICIENT_CREDITS);
        }
        throw error;
      }

      await createMessage({
        chatId,
        userId,
        role: "user",
        content,
        model: foundChat.model,
        provider: foundChat.provider,
      });

      const messages = [...history, { role: "user" as const, content }];

      let resolved: Awaited<ReturnType<typeof getAdapter>>;
      try {
        resolved = await getAdapter(foundChat.provider, foundChat.model);
      } catch (error) {
        await revokePreloadSafely(preload.consumedCreditId);
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json(respErr(message), STATUS_PROVIDER_ERROR);
      }

      const abortController = new AbortController();
      c.req.raw.signal.addEventListener("abort", () => abortController.abort(), { once: true });

      try {
        const stream = chat({
          adapter: resolved.adapter,
          messages,
          modelOptions: { [resolved.maxTokensKey]: preload.maxOutputTokens ?? 4096 },
          abortController,
          middleware: [
            createBillingMiddleware({
              onFinished: async ({ text, totalTokens }) => {
                try {
                  await settleChatCredits({
                    consumedCreditId: preload.consumedCreditId,
                    estimatedCost: preload.estimatedCost,
                    totalTokens,
                    provider: foundChat.provider,
                    model: foundChat.model,
                  });
                } catch (error) {
                  logger.warn("[llm] settleChatCredits failed after stream completion", error);
                }
                if (text) {
                  try {
                    await createMessage({
                      chatId,
                      userId,
                      role: "assistant",
                      content: text,
                      model: foundChat.model,
                      provider: foundChat.provider,
                    });
                    if (history.length === 0) {
                      await updateChat({ id: chatId, userId, title: content.slice(0, 50) });
                    }
                  } catch (error) {
                    logger.warn("[llm] failed to persist assistant message after stream", error);
                  }
                }
              },
            }),
          ],
        });

        return toServerSentEventsResponse(stream, { abortController });
      } catch (error) {
        await revokePreloadSafely(preload.consumedCreditId);
        const message = error instanceof Error ? error.message : "LLM error";
        return c.json(respErr(message), STATUS_PROVIDER_ERROR);
      }
    },
  );

async function revokePreloadSafely(consumedCreditId: string | null): Promise<void> {
  if (consumedCreditId === null) {
    return;
  }
  try {
    await revoke({ consumeCreditId: consumedCreditId });
  } catch (error) {
    logger.warn("[llm] failed to revoke preload after stream setup failure", error);
  }
}
