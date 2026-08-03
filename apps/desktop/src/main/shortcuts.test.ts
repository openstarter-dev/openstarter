// apps/desktop/src/main/shortcuts.test.ts
// 快捷键模块的纯逻辑部分

import { describe, expect, it } from "vitest";
import { unregisterShortcuts } from "./shortcuts";

describe("unregisterShortcuts", () => {
  it("does not throw when called with no shortcuts registered", () => {
    expect(() => unregisterShortcuts()).not.toThrow();
  });

  it("is safe to call multiple times", () => {
    expect(() => {
      unregisterShortcuts();
      unregisterShortcuts();
    }).not.toThrow();
  });
});