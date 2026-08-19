import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiProxy } from "./api-proxy";

describe("ApiProxy", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should inject Bearer token when token exists", async () => {
    const mockTokenStore = { get: () => "test-token-123" };
    const proxy = createApiProxy({
      baseUrl: "http://localhost:3000",
      getToken: () => mockTokenStore.get(),
      fetchFn: mockFetch,
    });

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: 200, message: "ok", data: { id: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await proxy({ method: "GET", path: "/api/user/profile" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/user/profile",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token-123",
        }),
      }),
    );
  });

  it("should omit Bearer header when no token", async () => {
    const proxy = createApiProxy({
      baseUrl: "http://localhost:3000",
      getToken: () => null,
      fetchFn: mockFetch,
    });

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: 200, message: "ok", data: {} }), {
        status: 200,
      }),
    );

    await proxy({ method: "POST", path: "/api/auth/sign-up", body: { email: "user@example.com" } });

    const call = mockFetch.mock.calls[0]!;
    expect(call[1]?.headers?.Authorization).toBeUndefined();
  });

  it("should return 401 when API returns 401", async () => {
    const proxy = createApiProxy({
      baseUrl: "http://localhost:3000",
      getToken: () => "expired-token",
      fetchFn: mockFetch,
    });

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: 401, message: "unauthorized" }), {
        status: 401,
      }),
    );

    const result = await proxy({ method: "GET", path: "/api/user/profile" });

    expect(result.code).toBe(401);
    expect(result.message).toBe("session_expired");
  });

  it("should validate path starts with /api/", async () => {
    const proxy = createApiProxy({
      baseUrl: "http://localhost:3000",
      getToken: () => null,
      fetchFn: mockFetch,
    });

    const result = await proxy({ method: "GET", path: "/etc/passwd" });

    expect(result.code).toBe(-1);
    expect(result.message).toContain("invalid");
  });

  it("should handle network errors", async () => {
    const proxy = createApiProxy({
      baseUrl: "http://localhost:3000",
      getToken: () => null,
      fetchFn: mockFetch,
    });

    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await proxy({ method: "GET", path: "/api/data" });

    expect(result.code).toBe(-1);
    expect(result.message).toBe("network_error");
  });
});
