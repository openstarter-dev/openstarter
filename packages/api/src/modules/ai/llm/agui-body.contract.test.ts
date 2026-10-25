/**
 * AG-UI 线格式契约测试（final-review M3 回归网）：
 * 用安装版 `@tanstack/ai` 的公开导出 `uiMessagesToWire`（真实客户端
 * `fetchServerSentEvents` POST body 内 `messages` 的来源 —— `@tanstack/ai-client`
 * 的 `buildRunAgentInputBody` 内部即调用它）生成序列化输出，再经
 * `sendMessageBody` + `extractLatestUserText` 往返断言。
 *
 * 关键回归点：anchor 形态 `{id, role, content}` **没有 parts**；只手写 parts
 * 的用例测不出真实客户端请求体被 schema 拒绝的问题。
 */

import { uiMessagesToWire, type UIMessage } from "@tanstack/ai";
import { describe, expect, it } from "vitest";

import { extractLatestUserText, sendMessageBody } from "./agui-body";

/** 复刻 @tanstack/ai-client buildRunAgentInputBody 的顶层信封（仅 messages 参与校验）。 */
const toSendBody = (messages: UIMessage[]) => ({
  threadId: "c1",
  runId: "r1",
  state: {},
  messages: uiMessagesToWire(messages),
  tools: [],
  context: [],
  forwardedProps: {},
  data: {},
});

describe("AG-UI wire contract (uiMessagesToWire → sendMessageBody)", () => {
  it("单条文本 UIMessage：anchor 形态无 parts，schema 通过且提取到文本", () => {
    const wire = uiMessagesToWire([
      { id: "m1", role: "user", parts: [{ type: "text", content: "帮我规划京都行程" }] },
    ]);

    // 实测锚点形状：无 parts，content 为字符串（本用例即迁移后的真实请求体）。
    expect(wire).toHaveLength(1);
    expect(wire[0]).not.toHaveProperty("parts");
    expect(wire[0]).toMatchObject({ id: "m1", role: "user", content: "帮我规划京都行程" });

    const parsed = sendMessageBody.safeParse(
      toSendBody([
        { id: "m1", role: "user", parts: [{ type: "text", content: "帮我规划京都行程" }] },
      ]),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(extractLatestUserText(parsed.data)).toBe("帮我规划京都行程");
  });

  it("多 part（多段 text + 历史 assistant）：content 拼接，取最后一条 user", () => {
    const messages: UIMessage[] = [
      { id: "m1", role: "user", parts: [{ type: "text", content: "旧问题" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", content: "旧回答" }] },
      {
        id: "m2",
        role: "user",
        parts: [
          { type: "text", content: "新问题，" },
          { type: "text", content: "分两段发送" },
        ],
      },
    ];
    const wire = uiMessagesToWire(messages);
    expect(wire.every((message) => !("parts" in message))).toBe(true);

    const parsed = sendMessageBody.safeParse(toSendBody(messages));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(extractLatestUserText(parsed.data)).toBe("新问题，分两段发送");
  });

  it("空文本 user 消息：schema 通过，提取为 null（业务空判仍归提取）", () => {
    const parsed = sendMessageBody.safeParse(
      toSendBody([{ id: "m1", role: "user", parts: [{ type: "text", content: "   " }] }]),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(extractLatestUserText(parsed.data)).toBeNull();
  });
});
