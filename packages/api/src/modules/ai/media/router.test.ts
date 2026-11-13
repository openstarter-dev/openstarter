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

vi.mock("../catalog/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../catalog/service")>()),
  findModelByProviderAndId: state.findModelByProviderAndId,
}));

vi.mock("../tasks/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../tasks/service")>()),
  createTask: state.createTask,
  findTask: state.findTask,
  updateTask: state.updateTask,
}));

vi.mock("./service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service")>()),
  dispatchGenerate: state.dispatchGenerate,
}));

vi.mock("./manager", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./manager")>()),
  getAIManager: state.getAIManager,
}));

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
    expect(computeConfigHash({ ...base, openai_api_key: "key-a" })).toBe(withKeyA);
  });
});
