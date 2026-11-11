// shared/runtime 测试：属性裁剪、错误出口、runSafely、noop / composite 策略。

import { describe, expect, it, vi } from "vitest";

import { createCompositeProvider } from "./composite";
import { createErrorReporter, errorContext, runSafely } from "./errors";
import { createNoopProvider } from "./noop";
import { sanitizeProperties } from "./sanitize";

import type { AnalyticsProvider } from "../types";

describe("sanitizeProperties", () => {
  it("returns undefined for empty or non-object input", () => {
    expect(sanitizeProperties(undefined)).toBeUndefined();
    expect(sanitizeProperties({})).toBeUndefined();
    expect(sanitizeProperties([] as unknown as Record<string, unknown>)).toBeUndefined();
  });

  it("keeps primitives and returns a new object", () => {
    const input = { count: 2, ok: true, plan: "pro" };
    const output = sanitizeProperties(input);

    expect(output).toEqual({ count: 2, ok: true, plan: "pro" });
    expect(output).not.toBe(input);
  });

  it("truncates long strings to 256 characters", () => {
    const output = sanitizeProperties({ long: "a".repeat(300) });
    expect(String(output?.long)).toHaveLength(256);
  });

  it("drops values that are not JSON-serializable", () => {
    const output = sanitizeProperties({
      fn: () => {},
      nan: Number.NaN,
      nil: null,
      nothing: undefined,
      sym: Symbol("x"),
      value: 1,
    });

    expect(output).toEqual({ value: 1 });
  });

  it("caps the number of keys at 30", () => {
    const input = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`k${index}`, index]),
    );

    expect(Object.keys(sanitizeProperties(input) ?? {})).toHaveLength(30);
  });

  it("keeps at most two levels of nested containers", () => {
    const output = sanitizeProperties({
      level1: { level2: "kept" },
      shallow: "v",
    });

    expect(output).toEqual({ level1: { level2: "kept" }, shallow: "v" });
  });

  it("drops containers beyond the second nesting level", () => {
    const output = sanitizeProperties({
      level1: { level2: { level3: { level4: "too deep" } }, kept: "ok" },
      shallow: "v",
    });

    expect(output).toEqual({ level1: { kept: "ok" }, shallow: "v" });
  });

  it("does not throw on circular references", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    expect(() => sanitizeProperties(circular)).not.toThrow();
  });
});

describe("createErrorReporter", () => {
  it("forwards errors to onError with context", () => {
    const onError = vi.fn();
    const report = createErrorReporter({ onError });

    report(new Error("boom"), { method: "track", provider: "plausible" });

    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      method: "track",
      provider: "plausible",
    });
  });

  it("logs only in debug mode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const silent = createErrorReporter();
    const loud = createErrorReporter({ debug: true });

    silent(new Error("quiet"), { method: "track", provider: "noop" });
    expect(warn).not.toHaveBeenCalled();

    loud(new Error("loud"), { method: "track", provider: "noop" });
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it("swallows exceptions thrown by the onError handler", () => {
    const report = createErrorReporter({
      onError: () => {
        throw new Error("handler exploded");
      },
    });

    expect(() => report(new Error("boom"), { method: "reset", provider: "noop" })).not.toThrow();
  });
});

describe("runSafely", () => {
  it("returns the action result on success", async () => {
    const report = vi.fn();
    await expect(runSafely(async () => 42, report, errorContext("noop", "track"))).resolves.toBe(42);
    expect(report).not.toHaveBeenCalled();
  });

  it("reports and resolves undefined on failure", async () => {
    const report = vi.fn();
    const result = await runSafely(
      () => {
        throw new Error("boom");
      },
      report,
      errorContext("noop", "track"),
    );

    expect(result).toBeUndefined();
    expect(report).toHaveBeenCalledWith(expect.any(Error), {
      method: "track",
      provider: "noop",
    });
  });
});

describe("createNoopProvider", () => {
  it("resolves every method and reports the noop name", async () => {
    const provider = createNoopProvider();

    expect(provider.name).toBe("noop");
    await expect(provider.track("e")).resolves.toBeUndefined();
    await expect(provider.identify("u")).resolves.toBeUndefined();
    await expect(provider.reset()).resolves.toBeUndefined();
    await expect(provider.setScreenName("/")).resolves.toBeUndefined();
    // init 可选：noop 不实现
    expect(provider.init).toBeUndefined();
  });
});

describe("createCompositeProvider", () => {
  const makeFake = (name: AnalyticsProvider["name"], withInit = false): AnalyticsProvider => {
    const base: AnalyticsProvider = {
      identify: vi.fn(),
      name,
      reset: vi.fn(),
      setScreenName: vi.fn(),
      track: vi.fn(),
    };
    return withInit ? { ...base, init: vi.fn() } : base;
  };

  it("forwards every call to all children in order", async () => {
    const first = makeFake("plausible");
    const second = makeFake("google-analytics");
    const composite = createCompositeProvider([first, second]);

    await composite.track("e", { a: 1 });
    await composite.identify("u", { plan: "pro" });
    await composite.reset();
    await composite.setScreenName("/x");

    expect(composite.name).toBe("composite");
    expect(first.track).toHaveBeenCalledWith("e", { a: 1 });
    expect(second.track).toHaveBeenCalledWith("e", { a: 1 });
    expect(first.identify).toHaveBeenCalledWith("u", { plan: "pro" });
    expect(second.reset).toHaveBeenCalledTimes(1);
    expect(second.setScreenName).toHaveBeenCalledWith("/x", undefined);
  });

  it("only calls init on children that implement it", async () => {
    const withoutInit = makeFake("plausible");
    const withInit = makeFake("openpanel", true);
    const composite = createCompositeProvider([withoutInit, withInit]);

    await composite.init?.();

    expect(withInit.init).toHaveBeenCalledTimes(1);
  });
});
