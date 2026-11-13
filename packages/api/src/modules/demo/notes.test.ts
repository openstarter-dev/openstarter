import { beforeEach, describe, expect, it, vi } from "vitest";

const NOTE_ID_PATTERN = /^note_\d+$/;

vi.mock("../../middleware/auth", async () => {
  const { createMiddleware } = await import("hono/factory");
  const requireAuth = createMiddleware<{
    Variables: { userId: string; session: null };
  }>(async (c, next) => {
    const userId = c.req.header("x-test-user-id") ?? "test-user";
    c.set("session", null);
    c.set("userId", userId);
    await next();
  });
  return { requireAuth };
});

import { demoRouter } from "./router";

function request(path: string, init: RequestInit & { userId?: string } = {}) {
  const userId = init.userId ?? "test-user";
  const { userId: _omit, ...rest } = init;
  return demoRouter.request(path, {
    ...rest,
    headers: { ...(rest.headers ?? {}), "x-test-user-id": userId },
  });
}

beforeEach(() => {
  // 笔记为进程内数组，跨测试共享。在每个用例前重置不便（模块闭包未暴露），
  // 故测试设计为单调递增的创建并断言"至少包含本测试创建的笔记"而非精确计数。
});

describe("notes routes", () => {
  it("POST /notes creates a note under the envelope", async () => {
    const response = await request("/notes", {
      body: JSON.stringify({
        description: "integration sanity check",
        name: "Integration Note",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body).toEqual({
      code: 0,
      data: {
        createdAt: expect.any(String),
        description: "integration sanity check",
        id: expect.stringMatching(NOTE_ID_PATTERN),
        name: "Integration Note",
        updatedAt: expect.any(String),
        userId: "test-user",
      },
      message: "ok",
    });
  });

  it("GET /notes lists notes scoped to the requesting user", async () => {
    await request("/notes", {
      body: JSON.stringify({ name: "A" }),
      headers: { "content-type": "application/json" },
      method: "POST",
      userId: "iso-user",
    });
    const alien = await request("/notes", {
      body: JSON.stringify({ name: "Alien" }),
      headers: { "content-type": "application/json" },
      method: "POST",
      userId: "other-user",
    });
    const alienId = (await alien.json()).data.id;

    const response = await request("/notes?limit=10", {
      userId: "iso-user",
    });
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(Array.isArray(body.data)).toBe(true);
    for (const note of body.data as Array<{ userId: string }>) {
      expect(note.userId).toBe("iso-user");
    }
    expect(body.data.some((n: { id: string }) => n.id === alienId)).toBe(false);
  });

  it("GET /notes/:id returns 404 envelope for missing note", async () => {
    const response = await request("/notes/note_nonexistent");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ code: -1, message: "note not found" });
  });

  it("POST /notes rejects invalid body with 422", async () => {
    const response = await request("/notes", {
      body: JSON.stringify({ description: "missing name" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect([400, 422]).toContain(response.status);
  });
});
