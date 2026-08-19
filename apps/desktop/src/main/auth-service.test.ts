import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthService } from "./auth-service";

describe("AuthService", () => {
  const mockFetch = vi.fn();
  const mockTokenStore = { get: vi.fn(), set: vi.fn(), clear: vi.fn() };
  const mockApiRequest = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signInWithEmail", () => {
    it("should sign in with email and password and store token", async () => {
      const mockSetCookie = [
        "openstarter.session_token=test-session-token; Path=/; HttpOnly; SameSite=None; Secure",
      ];
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          getSetCookie: () => mockSetCookie,
          get: (name: string) => (name === "set-cookie" ? mockSetCookie[0] : null),
        },
        json: () => Promise.resolve({ user: { id: "1", email: "test@test.com" } }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const auth = createAuthService({
        baseUrl: "http://localhost:3000",
        tokenStore: mockTokenStore,
        apiRequest: mockApiRequest,
        fetchFn: mockFetch,
      });

      const result = await auth.signInWithEmail("test@test.com", "password123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/auth/sign-in/email",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@test.com", password: "password123" }),
        }),
      );
      expect(mockTokenStore.set).toHaveBeenCalledWith("test-session-token");
      expect(result.user.email).toBe("test@test.com");
    });

    it("should throw on failed login", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: { getSetCookie: () => [], get: () => null },
        json: () => Promise.resolve({ message: "Invalid credentials" }),
      });

      const auth = createAuthService({
        baseUrl: "http://localhost:3000",
        tokenStore: mockTokenStore,
        apiRequest: mockApiRequest,
        fetchFn: mockFetch,
      });

      await expect(auth.signInWithEmail("bad@test.com", "wrong")).rejects.toThrow(
        "Invalid credentials",
      );
      expect(mockTokenStore.set).not.toHaveBeenCalled();
    });

    it("should throw if no session token in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { getSetCookie: () => [], get: () => null },
        json: () => Promise.resolve({ user: { id: "1" } }),
      });

      const auth = createAuthService({
        baseUrl: "http://localhost:3000",
        tokenStore: mockTokenStore,
        apiRequest: mockApiRequest,
        fetchFn: mockFetch,
      });

      await expect(auth.signInWithEmail("test@test.com", "pass")).rejects.toThrow(
        "No session token",
      );
    });
  });

  describe("getSession", () => {
    it("should return null when no token stored", async () => {
      mockTokenStore.get.mockReturnValue(null);

      const auth = createAuthService({
        baseUrl: "http://localhost:3000",
        tokenStore: mockTokenStore,
        apiRequest: mockApiRequest,
      });

      const result = await auth.getSession();
      expect(result).toBeNull();
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("should return user when session is valid", async () => {
      mockTokenStore.get.mockReturnValue("valid-token");
      mockApiRequest.mockResolvedValue({
        code: 200,
        message: "ok",
        data: { user: { id: "1", email: "test@test.com" } },
      });

      const auth = createAuthService({
        baseUrl: "http://localhost:3000",
        tokenStore: mockTokenStore,
        apiRequest: mockApiRequest,
      });

      const result = await auth.getSession();
      expect(result).not.toBeNull();
      expect(result!.user.email).toBe("test@test.com");
    });

    it("should return null when session expired", async () => {
      mockTokenStore.get.mockReturnValue("expired-token");
      mockApiRequest.mockResolvedValue({ code: 401, message: "session_expired" });

      const auth = createAuthService({
        baseUrl: "http://localhost:3000",
        tokenStore: mockTokenStore,
        apiRequest: mockApiRequest,
      });

      const result = await auth.getSession();
      expect(result).toBeNull();
    });
  });

  describe("signOut", () => {
    it("should call sign-out API and clear token", async () => {
      mockApiRequest.mockResolvedValue({ code: 200, message: "ok" });

      const auth = createAuthService({
        baseUrl: "http://localhost:3000",
        tokenStore: mockTokenStore,
        apiRequest: mockApiRequest,
      });

      await auth.signOut();

      expect(mockApiRequest).toHaveBeenCalledWith({
        method: "POST",
        path: "/api/auth/sign-out",
      });
      expect(mockTokenStore.clear).toHaveBeenCalled();
    });
  });
});
