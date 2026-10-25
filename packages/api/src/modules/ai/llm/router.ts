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
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { respData, respErr, respPage } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../../middleware/auth";
import { requirePlan } from "../../../middleware/plan-gate";
import { paginationSchema } from "../../../schema";

import { revoke } from "@openstarter/billing-web";
import { InsufficientCreditsError } from "../tasks/service";
import { extractLatestUserText, sendMessageBody } from "./agui-body";
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

// ─── Validation Schemas ──────────────────────────────────────────────────

const createChatBody = z.object({
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
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
      const body = c.req.valid("json");
      const content = extractLatestUserText(body);
      if (content === null) {
        return c.json(respErr("no user message to send"), STATUS_BAD_REQUEST);
      }
      if (body.threadId !== undefined && body.threadId !== chatId) {
        return c.json(respErr("threadId mismatch"), STATUS_BAD_REQUEST);
      }

      // Verify chat exists and belongs to user
      const foundChat = await getChat({ id: chatId, userId });
      if (!foundChat) {
        return c.json(respErr("Chat not found"), STATUS_NOT_FOUND);
      }

      // Get message history for context (and total chars for pre-charge estimation)
      const { messages: history, totalChars } = await getMessageHistory({ chatId, userId });

      // Pre-charge credits before persisting the user message. Insufficient
      // balance short-circuits with 402 — no user message, no stream.
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

      // Save user message
      await createMessage({
        chatId,
        userId,
        role: "user",
        content,
        model: foundChat.model,
        provider: foundChat.provider,
      });

      // Build messages array for AI SDK
      const messages = [...history, { role: "user" as const, content }];

      // 装配 adapter。预扣发生在装配之前 —— 若此处失败（如管理员事后撤掉了
      // provider key），必须先撤销预扣再返回 502，否则用户为从未开始的流式对话买单。
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
                // 结算失败绝不影响已完成的流 —— warn 后保留预扣（与迁移前一致）。
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
                    // 首条消息自动生成标题
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
        // chat() 装配期同步失败（未产生流）：同样先撤销预扣再报 502。
        await revokePreloadSafely(preload.consumedCreditId);
        const message = error instanceof Error ? error.message : "LLM error";
        return c.json(respErr(message), STATUS_PROVIDER_ERROR);
      }
    },
  );

/**
 * 撤销预扣（尽力而为）：仅在预扣真实发生（consumedCreditId 非空）时调用
 * `revoke`；撤销失败不影响原有错误响应 —— 记 warn 日志后继续（资金一致性
 * 由人工对账兜底，路由仍须返回真实失败原因）。
 */
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
