import { describe, expect, it, vi } from "vitest";

import type { FinishInfo } from "@tanstack/ai";

import { createBillingMiddleware } from "./billing-middleware";

const finishInfo = (overrides: Partial<FinishInfo> = {}): FinishInfo => ({
  finishReason: "stop",
  duration: 12,
  content: "你好",
  usage: { totalTokens: 42, promptTokens: 10, completionTokens: 32 },
  ...overrides,
});

describe("createBillingMiddleware", () => {
  it("onFinish → onFinished 恰一次，携带 content 与 totalTokens", async () => {
    const onFinished = vi.fn().mockResolvedValue(undefined);
    const middleware = createBillingMiddleware({ onFinished });

    await middleware.onFinish?.({} as never, finishInfo());

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith({ text: "你好", totalTokens: 42 });
  });

  it("usage 缺失 → totalTokens undefined（credits 侧将保留预扣）", async () => {
    const onFinished = vi.fn().mockResolvedValue(undefined);
    const middleware = createBillingMiddleware({ onFinished });

    await middleware.onFinish?.({} as never, finishInfo({ usage: undefined }));

    expect(onFinished).toHaveBeenCalledWith({ text: "你好", totalTokens: undefined });
  });

  it("onFinished 抛错不向外冒泡（副作用失败绝不反噬响应流）", async () => {
    const onFinished = vi.fn().mockRejectedValue(new Error("db down"));
    const middleware = createBillingMiddleware({ onFinished });

    await expect(middleware.onFinish?.({} as never, finishInfo())).resolves.toBeUndefined();
    expect(onFinished).toHaveBeenCalled();
  });

  it("不注册 onAbort/onError（契约：三选一，未实现即跳过）", () => {
    const middleware = createBillingMiddleware({ onFinished: vi.fn() });
    expect(middleware.onAbort).toBeUndefined();
    expect(middleware.onError).toBeUndefined();
  });
});
