/**
 * AI router tests — catalog-first credit pricing (Task 7).
 *
 * 目录优先计价经 POST `/ai-tasks` 间接验证（编排在 ../tasks/runner）：
 * 断言 `createTask` spy 收到的 `costCredits` 入参。沿用 ai/catalog/router.test.ts
 * 的 harness：requireAuth 走 x-test-user-id header mock，plan-gate 透传；
 * `../tasks/service`（createTask/findTask/updateTask）、`./service`（dispatchGenerate）、
 * `./manager`（getAIManager 哨兵）与目录查询（findModelByProviderAndId）全部 mock
 * ——本文件聚焦路由接线与计价分支，不触真实数据库与供应商 I/O。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configs: {} as Record<string, string>,
  findModelByProviderAndId: vi.fn(),
  createTask: vi.fn(),
  findTask: vi.fn(),
  updateTask: vi.fn(),
  dispatchGenerate: vi.fn(),
  getAIManager: vi.fn(),
}));

vi.mock("@openstarter/shared/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@openstarter/shared/config")>()),
  getAllConfigs: () => Promise.resolve(state.configs),
}));

// 目录价查询（Task 3 service）：命中 / 未命中 / 0 价 / 查询失败四种分支由用例驱动。
vi.mock("../catalog/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../catalog/service")>()),
  findModelByProviderAndId: state.findModelByProviderAndId,
}));

// 任务生命周期 + 原子扣减：仅 spy 断言入参（计费语义由 ai-tasks 自身测试覆盖）。
// 编排层（../tasks/runner）直接依赖同域的 ./service，故 mock 具体 service 模块；
// barrel（../tasks）会转发同一模块的绑定，不影响下方 InsufficientCreditsError 导入。
vi.mock("../tasks/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../tasks/service")>()),
  createTask: state.createTask,
  findTask: state.findTask,
  updateTask: state.updateTask,
}));

// 供应商分派：固定成功返回处理中句柄（分派语义由 fal/replicate 侧测试覆盖）。
vi.mock("./service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service")>()),
  dispatchGenerate: state.dispatchGenerate,
}));

// 供应商可用性：固定返回 replicate 哨兵（装配语义由 manager 测试覆盖）。
vi.mock("./manager", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./manager")>()),
  getAIManager: state.getAIManager,
}));

// requireAuth：从 x-test-user-id header 注入 userId，不做真实鉴权（notes.test.ts 同款）。
vi.mock("../../../middleware/auth", async () => {
  const { createMiddleware } = await import("hono/factory");
  const requireAuth = createMiddleware<{
    Variables: { userId: string; session: null };
  }>(async (c, next) => {
    c.set("session", null);
    c.set("userId", c.req.header("x-test-user-id") ?? "test-user");
    await next();
  });
  return { requireAuth };
});

// requirePlan：透传中间件（拒绝语义由中间件自身测试覆盖）。
vi.mock("../../../middleware/plan-gate", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware(async (_c, next) => {
    await next();
  });
  return { requirePlan: () => passthrough };
});

import { InsufficientCreditsError } from "../tasks";
import { computeConfigHash } from "./manager";
import { aiRouter } from "./router";

const TEST_USER_ID = "test-user-ai-router";

const STUB_MANAGER = {
  getDefaultProvider: () => ({ name: "replicate" }),
  getProvider: (name: string) => ({ name }),
};

function createTaskRequest(body: unknown) {
  return aiRouter.request("/ai-tasks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-test-user-id": TEST_USER_ID,
    },
  });
}

beforeEach(() => {
  state.configs = { ai_credits_cost_image: "5", ai_credits_cost_video: "20" };

  state.getAIManager.mockReset();
  state.getAIManager.mockResolvedValue(STUB_MANAGER);

  state.findModelByProviderAndId.mockReset();
  state.createTask.mockReset();
  state.findTask.mockReset();
  state.updateTask.mockReset();
  state.dispatchGenerate.mockReset();

  // 默认快乐路径接线：目录未命中、分派成功、任务回读返回处理中。
  state.dispatchGenerate.mockResolvedValue({
    success: true,
    data: { taskStatus: "processing", taskId: "provider-task-1" },
  });
  state.updateTask.mockResolvedValue(undefined);
  state.createTask.mockImplementation(async (params: Record<string, unknown>) => ({
    id: "task-1",
    status: "pending",
    costCredits: 0,
    ...params,
  }));
  state.findTask.mockResolvedValue({
    id: "task-1",
    status: "processing",
    taskId: "provider-task-1",
  });
});

describe("POST /ai-tasks — catalog-first credit pricing", () => {
  it("uses the catalog creditPrice when a priced model row exists", async () => {
    state.findModelByProviderAndId.mockResolvedValue({
      id: "m1",
      provider: "replicate",
      modelId: "test-model",
      displayName: "Test Model",
      mediaType: "image",
      creditPrice: 7,
      enabled: true,
      sortOrder: 0,
    });

    const response = await createTaskRequest({
      mediaType: "image",
      provider: "replicate",
      model: "test-model",
      prompt: "a cat",
    });

    expect(response.status).toBe(200);
    expect(state.findModelByProviderAndId).toHaveBeenCalledTimes(1);
    expect(state.findModelByProviderAndId).toHaveBeenCalledWith("replicate", "test-model");
    expect(state.createTask).toHaveBeenCalledTimes(1);
    expect(state.createTask.mock.calls[0]?.[0]).toMatchObject({
      userId: TEST_USER_ID,
      mediaType: "image",
      provider: "replicate",
      model: "test-model",
      costCredits: 7,
    });
  });

  it("falls back to the config price when the catalog has no such row (provider resolved from default)", async () => {
    state.findModelByProviderAndId.mockResolvedValue(null);

    const response = await createTaskRequest({
      mediaType: "image",
      model: "unlisted-model",
      prompt: "a cat",
    });

    expect(response.status).toBe(200);
    // 省略 provider 时按解析后的默认供应商查目录（目录键为解析后的 provider）。
    expect(state.findModelByProviderAndId).toHaveBeenCalledWith("replicate", "unlisted-model");
    expect(state.createTask.mock.calls[0]?.[0]).toMatchObject({ costCredits: 5 });
  });

  it("falls back to the config price when the catalog row has creditPrice 0", async () => {
    state.findModelByProviderAndId.mockResolvedValue({
      id: "m1",
      provider: "replicate",
      modelId: "test-model",
      displayName: "Free Model",
      mediaType: "image",
      creditPrice: 0,
      enabled: true,
      sortOrder: 0,
    });

    const response = await createTaskRequest({
      mediaType: "image",
      provider: "replicate",
      model: "test-model",
      prompt: "a cat",
    });

    expect(response.status).toBe(200);
    // 目录价 0 视为未定价：绝不下发免费价，回退配置。
    expect(state.createTask.mock.calls[0]?.[0]).toMatchObject({ costCredits: 5 });
  });

  it("falls back to the config price when the catalog lookup throws", async () => {
    state.findModelByProviderAndId.mockRejectedValue(new Error("catalog down"));

    const response = await createTaskRequest({
      mediaType: "video",
      provider: "replicate",
      model: "test-model",
      prompt: "a cat",
    });

    expect(response.status).toBe(200);
    // 目录查询失败不阻塞任务创建，按 mediaType 配置价计费。
    expect(state.createTask.mock.calls[0]?.[0]).toMatchObject({ costCredits: 20 });
  });

  it("returns 402 when createTask rejects with InsufficientCreditsError", async () => {
    state.findModelByProviderAndId.mockResolvedValue(null);
    state.createTask.mockRejectedValue(new InsufficientCreditsError());

    const response = await createTaskRequest({
      mediaType: "image",
      provider: "replicate",
      model: "test-model",
      prompt: "a cat",
    });

    expect(response.status).toBe(402);
    const body = (await response.json()) as { code: number; message: string; data?: unknown };
    expect(body.message).toBe("insufficient credits");
    // respErr 不携带 data 字段（ApiResponse.data 可选，失败时省略）。
    expect(body.data).toBeUndefined();
  });
});

describe("computeConfigHash", () => {
  it("changes when only openai_api_key changes (key rotation invalidates the manager cache)", () => {
    const base = {
      default_ai_provider: "replicate",
      replicate_enabled: "1",
      replicate_api_token: "tok",
    };

    const withKeyA = computeConfigHash({ ...base, openai_api_key: "key-a" });
    const withKeyB = computeConfigHash({ ...base, openai_api_key: "key-b" });

    expect(withKeyA).not.toBe(withKeyB);
    // 同入参哈希稳定。
    expect(computeConfigHash({ ...base, openai_api_key: "key-a" })).toBe(withKeyA);
  });
});
