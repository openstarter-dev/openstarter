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
