// packages/api/src/middleware/plan-gate.test.ts —— 订阅方案守卫中间件测试。
//
// 测试策略：
//   - 使用 `vi.mock` 注入 `getUserPlan` 返回值，不依赖数据库。
//   - 用 `createMiddleware` 设置桩 `userId` 模拟 `requireAuth` 的契约。
//   - 覆盖：401（无 userId）、403（方案不足）、通过（方案充足）、层级语义。

import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requirePlan } from "./plan-gate";

// 注入桩 `getUserPlan`。`@openstarter/auth` 的真实实现依赖数据库，
// 测试中返回受控值。vi.mock 调用会被 hoist 到文件顶部执行。
vi.mock("@openstarter/auth", () => ({
  getUserPlan: vi.fn(),
}));

// 导入被 mock 的模块（import 实际发生在 vi.mock 之后，拿到的是 mock 版本）。
import { getUserPlan } from "@openstarter/auth";
const mockGetUserPlan = vi.mocked(getUserPlan);

/**
 * 构建一个测试用 Hono 应用，模拟 `requireAuth` → `requirePlan` → handler 的中间件链。
 *
 * 为避免 Hono 类型对展开中间件数组的限制，通过 `app.use` 注册中间件链，
 * 再单独定义路由处理函数。
 */
function buildApp(
  userId: string | null,
  requiredPlan: Parameters<typeof requirePlan>[0] = "member"
) {
  const handler = vi.fn((c) => c.json({ ok: true }));
  const app = new Hono<{ Variables: { userId: string } }>();

  if (userId) {
    // 模拟 `requireAuth` 的契约：设置 c.var.userId。
    app.use(
      "/protected",
      createMiddleware<{ Variables: { userId: string } }>(
        async (c, next) => {
          c.set("userId", userId);
          await next();
        }
      )
    );
  }

  app.use("/protected", requirePlan(requiredPlan));
  app.get("/protected", handler);

  return { app, handler };
}

describe("plan-gate middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when userId is not set on context", async () => {
    const { app, handler } = buildApp(null);
    const response = await app.request("/protected");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: -1,
      message: "Unauthorized",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when user plan is below the required minimum", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "none" });
    const { app, handler } = buildApp("user-1");
    const response = await app.request("/protected");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: -1,
      message: "This feature requires a member plan. Current plan: none.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes through when user plan meets the required minimum", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "member" });
    const { app, handler } = buildApp("user-1");
    const response = await app.request("/protected");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("allows member plan to access trial-gated routes", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "member" });
    const { app, handler } = buildApp("user-1", "trial");

    const response = await app.request("/protected");
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("denies trial plan access to member-gated routes", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "trial" });
    const { app, handler } = buildApp("user-1", "member");

    const response = await app.request("/protected");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: -1,
      message: "This feature requires a member plan. Current plan: trial.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows trial plan to access trial-gated routes", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "trial" });
    const { app, handler } = buildApp("user-1", "trial");

    const response = await app.request("/protected");
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("treats expired plan same as none (level 0)", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "expired" });
    const { app, handler } = buildApp("user-1", "member");

    const response = await app.request("/protected");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: -1,
      message: "This feature requires a member plan. Current plan: expired.",
    });
    expect(handler).not.toHaveBeenCalled();
  });
});