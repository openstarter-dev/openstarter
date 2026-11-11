// 配置缓存测试：TTL 命中、过期重取、失败不写槽、空配置可缓存。

import { describe, expect, it, vi } from "vitest";

import { createAnalyticsConfigCache, EMPTY_ANALYTICS_CONFIG } from "./config-cache";

import type { AnalyticsConfig } from "./types";

const config = (id: string): AnalyticsConfig => ({
  googleAnalyticsId: id,
  plausibleDomain: "",
  plausibleSrc: "",
});

describe("createAnalyticsConfigCache", () => {
  it("caches a successful read within the TTL", async () => {
    let now = 0;
    const cache = createAnalyticsConfigCache({ now: () => now, ttlMs: 1000 });
    const fetcher = vi.fn(async () => config("G-1"));

    const first = await cache.get(fetcher);
    now = 500;
    const second = await cache.get(fetcher);

    expect(first).toEqual(config("G-1"));
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL expires", async () => {
    let now = 0;
    const cache = createAnalyticsConfigCache({ now: () => now, ttlMs: 1000 });
    const fetcher = vi.fn(async () => config("G-1"));

    await cache.get(fetcher);
    now = 1000;
    await cache.get(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures: the next call retries immediately", async () => {
    let now = 0;
    const cache = createAnalyticsConfigCache({ now: () => now, ttlMs: 30_000 });
    const failing = vi.fn(async () => undefined);
    const working = vi.fn(async () => config("G-2"));

    const failed = await cache.get(failing);
    now = 10;
    const recovered = await cache.get(working);

    expect(failed).toEqual(EMPTY_ANALYTICS_CONFIG);
    expect(recovered).toEqual(config("G-2"));
    expect(working).toHaveBeenCalledTimes(1);
  });

  it("treats an explicitly empty config as cacheable (no provider configured)", async () => {
    let now = 0;
    const cache = createAnalyticsConfigCache({ now: () => now, ttlMs: 1000 });
    const fetcher = vi.fn(async () => EMPTY_ANALYTICS_CONFIG);

    await cache.get(fetcher);
    now = 100;
    const second = await cache.get(fetcher);

    expect(second).toEqual(EMPTY_ANALYTICS_CONFIG);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
