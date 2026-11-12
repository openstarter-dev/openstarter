// packages/api/src/schema/ai/llm —— llm 域入参校验（modules/ai/llm 路由复用）。
//
// AG-UI sendMessage 请求体（TanStack AI useChat 经 fetchServerSentEvents POST 的
// wire 格式）。服务端不信任客户端 transcript：上下文一律以 DB 历史为准，仅提取
// 「最新一条 user 消息」的纯文本用于落库与本轮输入（提取逻辑见
// modules/ai/llm/agui-body.ts 的 extractLatestUserText）。
//
// 线格式有两种形态：AG-UI anchor 是 `{id, role, content}` 字符串，parts-based
// UIMessage 是 `{id, role, parts}`。
import { z } from "zod";

export const textPartSchema = z.object({ type: z.literal("text"), content: z.string() });

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

export const createChatBody = z.object({
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});
