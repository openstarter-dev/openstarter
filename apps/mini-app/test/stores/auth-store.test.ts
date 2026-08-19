import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tarojs/taro", () => ({
  default: {
    getStorageSync: vi.fn(() => null),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: vi.fn(),
  },
}));

describe("auth-store", () => {
  beforeEach(async () => {
    const { useAuthStore } = await import("../../src/stores/auth-store");
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false, isHydrated: false });
  });

  it("should start with null token and user", async () => {
    const { useAuthStore } = await import("../../src/stores/auth-store");
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should set token and mark authenticated", async () => {
    const { useAuthStore } = await import("../../src/stores/auth-store");
    useAuthStore.getState().setSession("test-token", { id: "1", email: "a@b.com" });
    const state = useAuthStore.getState();
    expect(state.token).toBe("test-token");
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: "1", email: "a@b.com" });
  });

  it("should clear session on logout", async () => {
    const { useAuthStore } = await import("../../src/stores/auth-store");
    useAuthStore.getState().setSession("test-token", { id: "1", email: "a@b.com" });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should call getSession on hydrate when token exists", async () => {
    const { authClient } = await import("../../src/lib/auth-client");
    (authClient.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: "1", email: "a@b.com" } },
    });

    // Provide a token in storage
    const Taro = (await import("@tarojs/taro")).default as any;
    Taro.getStorageSync.mockReturnValue("test-token");

    const { useAuthStore } = await import("../../src/stores/auth-store");
    await useAuthStore.getState().hydrate();

    expect(authClient.getSession).toHaveBeenCalled();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: "1", email: "a@b.com" });
  });

  it("should clear invalid token on hydrate failure", async () => {
    const { authClient } = await import("../../src/lib/auth-client");
    (authClient.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
    });

    const Taro = (await import("@tarojs/taro")).default as any;
    Taro.getStorageSync.mockReturnValue("invalid-token");

    const { useAuthStore } = await import("../../src/stores/auth-store");
    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should handle network error gracefully on hydrate", async () => {
    const { authClient } = await import("../../src/lib/auth-client");
    (authClient.getSession as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    const Taro = (await import("@tarojs/taro")).default as any;
    Taro.getStorageSync.mockReturnValue("test-token");

    const { useAuthStore } = await import("../../src/stores/auth-store");
    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.isHydrated).toBe(true);
  });
});
