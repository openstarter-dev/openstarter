import { describe, it, expect, vi } from "vitest";

const { mockReLaunch } = vi.hoisted(() => ({
  mockReLaunch: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: {
    request: vi.fn(),
    getStorageSync: vi.fn(() => null),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    reLaunch: mockReLaunch,
  },
}));
vi.mock("@/utils/storage", () => ({
  getToken: vi.fn(() => null),
  removeToken: vi.fn(),
}));
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      logout: vi.fn(),
    })),
  },
}));

describe("API client", () => {
  it("should export a fetch client singleton", async () => {
    const mod = await import("../../src/services/client");
    expect(mod.client).toBeDefined();
    expect(typeof mod.client.get).toBe("function");
    expect(typeof mod.client.post).toBe("function");
  });
});
