/**
 * AG-UI sendMessage 请求体解析（TanStack AI useChat 经 fetchServerSentEvents
 * POST 的 wire 格式）。服务端不信任客户端 transcript：上下文一律以 DB 历史
 * 为准，仅提取「最新一条 user 消息」的纯文本用于落库与本轮输入。
 *
 * 线格式有两种形态（见 extractLatestUserText）：AG-UI anchor 是
 * `{id, role, content}` 字符串，parts-based UIMessage 是 `{id, role, parts}`。
 */

import { z } from "zod";

const textPartSchema = z.object({ type: z.literal("text"), content: z.string() });

export const sendMessageBody = z.object({
  threadId: z.string().optional(),
  runId: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        // 线格式 role 可能演进（tool/reasoning 等），服务端只用来定位最后一条
        // user 消息，不做枚举校验。
        role: z.string().min(1),
        parts: z.array(z.unknown()).optional(),
        content: z.string().optional(),
      }),
    )
    .min(1),
  forwardedProps: z.record(z.string(), z.unknown()).optional(),
});

export type SendMessageBody = z.infer<typeof sendMessageBody>;

/**
 * 最后一条 user 消息的纯文本（trim 后）；不存在可发文本时返回 null。
 *
 * 两种线格式并存：`@tanstack/ai` 的 `uiMessagesToWire` 把 UIMessage 序列化为
 * AG-UI anchor（user 消息为 `{id, role, content}` 字符串，无 parts），而
 * parts-based UIMessage 仍带 `{type:"text", content}` parts。有 parts 时沿用
 * parts 提取（行为不变）；否则回退到 anchor 的 `content` 字符串。DB 仍是
 * 上下文的唯一可信来源。
 */
export function extractLatestUserText(body: SendMessageBody): string | null {
  for (let i = body.messages.length - 1; i >= 0; i -= 1) {
    const message = body.messages[i];
    if (message == null || message.role !== "user") continue;
    if (message.parts === undefined) {
      const text = typeof message.content === "string" ? message.content.trim() : "";
      return text.length > 0 ? text : null;
    }
    const text = message.parts
      .flatMap((part) => {
        const parsed = textPartSchema.safeParse(part);
        return parsed.success ? [parsed.data.content] : [];
      })
      .join("")
      .trim();
    return text.length > 0 ? text : null;
  }
  return null;
}
