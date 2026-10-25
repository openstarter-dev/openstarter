import { describe, expect, it } from "vitest";

import { extractLatestUserText, sendMessageBody } from "./agui-body";

const userMsg = (parts: unknown[]) => ({ id: "m1", role: "user" as const, parts });

describe("sendMessageBody", () => {
  it("接受 AG-UI 最小形状", () => {
    const parsed = sendMessageBody.safeParse({
      threadId: "c1",
      messages: [userMsg([{ type: "text", content: "hi" }])],
    });
    expect(parsed.success).toBe(true);
  });

  it("messages 为空则失败", () => {
    expect(sendMessageBody.safeParse({ messages: [] }).success).toBe(false);
  });

  it("接受 runId 与 forwardedProps", () => {
    const parsed = sendMessageBody.safeParse({
      threadId: "c1",
      runId: "r1",
      messages: [userMsg([{ type: "text", content: "hi" }])],
      forwardedProps: { locale: "zh-CN" },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("extractLatestUserText", () => {
  it("拼接单条 user 消息的 text parts", () => {
    const body = sendMessageBody.parse({
      messages: [
        userMsg([
          { type: "text", content: "Hello " },
          { type: "text", content: "world" },
        ]),
      ],
    });
    expect(extractLatestUserText(body)).toBe("Hello world");
  });

  it("取最后一条 user 消息，其 text parts 跳过非 text part", () => {
    const body = sendMessageBody.parse({
      messages: [
        userMsg([{ type: "text", content: "old" }]),
        { id: "a1", role: "assistant", parts: [{ type: "text", content: "reply" }] },
        {
          id: "m2",
          role: "user",
          parts: [
            { type: "tool-call", id: "t", name: "x", arguments: "{}" },
            { type: "text", content: "new" },
          ],
        },
      ],
    });
    expect(extractLatestUserText(body)).toBe("new");
  });

  it("无 user 消息或 text 为空 → null", () => {
    const noUser = sendMessageBody.parse({
      messages: [{ id: "a1", role: "assistant", parts: [{ type: "text", content: "r" }] }],
    });
    expect(extractLatestUserText(noUser)).toBeNull();
    const blank = sendMessageBody.parse({
      messages: [userMsg([{ type: "text", content: "   " }])],
    });
    expect(extractLatestUserText(blank)).toBeNull();
  });

  it("parts 为空数组：schema 通过，提取为 null", () => {
    const body = { messages: [userMsg([])] };
    expect(sendMessageBody.safeParse(body).success).toBe(true);
    expect(extractLatestUserText(sendMessageBody.parse(body))).toBeNull();
  });

  it("跳过 system 消息", () => {
    const body = sendMessageBody.parse({
      messages: [
        userMsg([{ type: "text", content: "ask" }]),
        { id: "s1", role: "system", parts: [{ type: "text", content: "sys" }] },
      ],
    });
    expect(extractLatestUserText(body)).toBe("ask");
  });
});
