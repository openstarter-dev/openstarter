// 注意：Taro storage API 在 node 环境不可用，
// 此测试验证接口签名正确而非运行期行为。
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
