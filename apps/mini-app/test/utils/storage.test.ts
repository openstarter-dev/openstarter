import { describe, it, expect, vi } from "vitest";

vi.mock("@tarojs/taro", () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}));

describe("storage utils", () => {
  it("should export expected functions", async () => {
    const mod = await import("../../src/utils/storage");
    expect(typeof mod.getToken).toBe("function");
    expect(typeof mod.setToken).toBe("function");
    expect(typeof mod.removeToken).toBe("function");
  });
});
