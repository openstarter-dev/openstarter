import { uiMessagesToWire, type UIMessage } from "@tanstack/ai";
import { describe, expect, it } from "vitest";

import { sendMessageBody } from "../../../schema/ai/llm";
import { extractLatestUserText } from "./agui-body";

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
