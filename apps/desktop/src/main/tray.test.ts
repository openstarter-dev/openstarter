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
