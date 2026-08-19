// apps/desktop/src/main/tray.test.ts
// 托盘模块的测试主要验证逻辑分支，不测试 Electron 运行时
// 由于 createTray 直接依赖 Electron Tray 类，单元测试覆盖有限
// 主要测试 destroyTray 的空安全逻辑

import { describe, expect, it } from "vitest";
import { destroyTray } from "./tray";

describe("destroyTray", () => {
  it("does not throw when called with no tray created", () => {
    expect(() => destroyTray()).not.toThrow();
  });

  it("is safe to call multiple times", () => {
    expect(() => {
      destroyTray();
      destroyTray();
    }).not.toThrow();
  });
});
