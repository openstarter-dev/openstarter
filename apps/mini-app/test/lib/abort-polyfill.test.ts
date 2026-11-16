import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const NativeAbortController = globalThis.AbortController;

describe("abort-polyfill", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.AbortController = NativeAbortController;
  });

  it("should keep the native AbortController when present", async () => {
    await import("../../src/lib/abort-polyfill");
    expect(globalThis.AbortController).toBe(NativeAbortController);
  });

  it("should install a working AbortController when missing", async () => {
    (globalThis as any).AbortController = undefined;
    await import("../../src/lib/abort-polyfill");

    const controller = new globalThis.AbortController();
    expect(controller.signal.aborted).toBe(false);

    const listener = vi.fn();
    controller.signal.addEventListener("abort", listener, { once: true });
    controller.abort();

    expect(controller.signal.aborted).toBe(true);
    expect((controller.signal.reason as Error).name).toBe("AbortError");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should honor removeEventListener and custom abort reason", async () => {
    (globalThis as any).AbortController = undefined;
    await import("../../src/lib/abort-polyfill");

    const controller = new globalThis.AbortController();
    const listener = vi.fn();
    controller.signal.addEventListener("abort", listener);
    controller.signal.removeEventListener("abort", listener);
    controller.abort("custom-reason");

    expect(listener).not.toHaveBeenCalled();
    expect(controller.signal.reason).toBe("custom-reason");
  });
});
