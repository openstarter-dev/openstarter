import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdapter: vi.fn(),
  preloadChatCredits: vi.fn(),
  settleChatCredits: vi.fn(),
  revoke: vi.fn(),
  getChat: vi.fn(),
  getMessageHistory: vi.fn(),
  createMessage: vi.fn(),
  updateChat: vi.fn(),
  chat: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  requireAuth: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set("userId", "u1");
    await next();
  },
}));
vi.mock("../../../middleware/plan-gate", () => ({
  requirePlan: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock("./provider", () => ({
  getModel: vi.fn(),
  getAdapter: mocks.getAdapter,
  isLLMEnabled: vi.fn(),
}));
vi.mock("./credits", () => ({
  preloadChatCredits: mocks.preloadChatCredits,
  settleChatCredits: mocks.settleChatCredits,
}));
vi.mock("./service", () => ({
  createChat: vi.fn(),
  getChat: mocks.getChat,
  getUserChats: vi.fn(),
  deleteChat: vi.fn(),
  updateChat: mocks.updateChat,
  createMessage: mocks.createMessage,
  getChatMessages: vi.fn(),
  getMessageHistory: mocks.getMessageHistory,
}));
vi.mock("@openstarter/billing-web", () => ({ revoke: mocks.revoke }));
vi.mock("@tanstack/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/ai")>();
  return { ...actual, chat: mocks.chat };
});

import { InsufficientCreditsError } from "../tasks/service";
import { llmRouter } from "./router";

const AGUI_BODY = {
  threadId: "c1",
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", content: "你好" }] }],
};

type AnyMiddleware = {
  onFinish?: (ctx: unknown, info: unknown) => unknown;
};

function fakeChat(mode: "finish" | "abort" | "error", content = "答") {
  return (options: { middleware?: Array<AnyMiddleware> }) =>
    (async function* () {
      yield { type: "TEXT_MESSAGE_CONTENT", delta: content };
      if (mode === "finish") {
        for (const middleware of options.middleware ?? []) {
          await middleware.onFinish?.(
            {},
            {
              finishReason: "stop",
              duration: 1,
              content,
              usage: { totalTokens: 42, promptTokens: 10, completionTokens: 32 },
            },
          );
        }
        yield { type: "RUN_FINISHED" };
      }
      if (mode === "error") throw new Error("upstream died");
      // abort：自然结束迭代但不触发 onFinish —— 断言副作用未发生。
    })();
}

async function post(body: unknown) {
  const res = await llmRouter.request("/llm/chats/c1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { res, text };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getChat.mockResolvedValue({ id: "c1", provider: "openai", model: "gpt-4o-mini" });
  mocks.getMessageHistory.mockResolvedValue({ messages: [], totalChars: 0 });
  mocks.preloadChatCredits.mockResolvedValue({
    consumedCreditId: "cr1",
    estimatedCost: 3,
    maxOutputTokens: 1024,
  });
  mocks.getAdapter.mockResolvedValue({ adapter: {}, maxTokensKey: "max_tokens" });
  mocks.createMessage.mockResolvedValue(undefined);
  mocks.updateChat.mockResolvedValue(undefined);
  mocks.settleChatCredits.mockResolvedValue(undefined);
  mocks.chat.mockImplementation((_o: unknown) => fakeChat("finish")(_o as never));
});

describe("POST /llm/chats/:id/messages", () => {
  it("正常完成：settle 带 totalTokens=42、assistant 落库、SSE 含文本", async () => {
    const { res, text } = await post(AGUI_BODY);

    expect(res.status).toBe(200);
    expect(text).toContain("答");
    expect(mocks.settleChatCredits).toHaveBeenCalledTimes(1);
    expect(mocks.settleChatCredits).toHaveBeenCalledWith(
      expect.objectContaining({ consumedCreditId: "cr1", totalTokens: 42 }),
    );
    expect(mocks.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "assistant", content: "答" }),
    );
  });

  it("threadId 与路径不符 → 400，不预扣", async () => {
    const { res } = await post({ ...AGUI_BODY, threadId: "other" });
    expect(res.status).toBe(400);
    expect(mocks.preloadChatCredits).not.toHaveBeenCalled();
  });

  it("无可提取 user 文本 → 400", async () => {
    const { res } = await post({
      messages: [{ id: "a", role: "assistant", parts: [{ type: "text", content: "x" }] }],
    });
    expect(res.status).toBe(400);
  });

  it("积分不足 → 402，不落库不调 chat", async () => {
    mocks.preloadChatCredits.mockRejectedValue(new InsufficientCreditsError());
    const { res } = await post(AGUI_BODY);
    expect(res.status).toBe(402);
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it("getAdapter 失败 → 502 + 撤销预扣", async () => {
    mocks.getAdapter.mockRejectedValue(new Error("OpenAI API key not configured (openai_api_key)"));
    const { res } = await post(AGUI_BODY);
    expect(res.status).toBe(502);
    expect(mocks.revoke).toHaveBeenCalledWith({ consumeCreditId: "cr1" });
    expect(mocks.settleChatCredits).not.toHaveBeenCalled();
  });

  it("中断（onAbort 路径）：不 settle、不落库、不撤销（保留预扣）", async () => {
    mocks.chat.mockImplementation((_o: unknown) => fakeChat("abort")(_o as never));
    await post(AGUI_BODY);
    expect(mocks.settleChatCredits).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.createMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ role: "assistant" }),
    );
  });

  it("流中途抛错（onError 路径）：不 settle、不落库、不撤销", async () => {
    mocks.chat.mockImplementation((_o: unknown) => fakeChat("error")(_o as never));
    await post(AGUI_BODY).catch(() => undefined);
    expect(mocks.settleChatCredits).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.createMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ role: "assistant" }),
    );
  });
});
