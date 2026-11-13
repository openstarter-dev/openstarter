import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requirePlan } from "./plan-gate";

vi.mock("@openstarter/auth", () => ({
  getUserPlan: vi.fn(),
}));

import { getUserPlan } from "@openstarter/auth";
const mockGetUserPlan = vi.mocked(getUserPlan);

function buildApp(
  userId: string | null,
  requiredPlan: Parameters<typeof requirePlan>[0] = "member",
) {
  const handler = vi.fn((c) => c.json({ ok: true }));
  const app = new Hono<{ Variables: { userId: string } }>();

  if (userId) {
    app.use(
      "/protected",
      createMiddleware<{ Variables: { userId: string } }>(async (c, next) => {
        c.set("userId", userId);
        await next();
      }),
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
