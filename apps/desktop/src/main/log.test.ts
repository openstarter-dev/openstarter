import { describe, expect, it, vi } from "vitest";

import { logError, logInfo, logWarn } from "./log";

describe("log", () => {
  it("logInfo writes a prefixed line to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    logInfo("server ready", "on port", 3000);

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line).toContain("[desktop]");
    expect(line).toContain("server ready");
    expect(line).toContain("on port");
    expect(line).toContain("3000");
    expect(line.endsWith("\n")).toBe(true);

    spy.mockRestore();
  });

  it("logWarn writes a prefixed line to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    logWarn("update check skipped");

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line).toContain("[desktop]");
    expect(line).toContain("update check skipped");

    spy.mockRestore();
  });

  it("logError writes a prefixed line to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    logError("failed to load", new Error("boom"));

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line).toContain("[desktop]");
    expect(line).toContain("failed to load");

    spy.mockRestore();
  });
});
