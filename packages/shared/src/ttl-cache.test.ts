import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTtlCache } from "./ttl-cache";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createTtlCache", () => {
  it("miss 后 set，再 get 命中", () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    expect(cache.get("a")).toBeUndefined();
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.size).toBe(1);
  });

  it("TTL 过期后 get 视为未命中并清除条目", () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vi.advanceTimersByTime(1000);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("TTL 内命中，边界值（expiresAt === now）判为过期", () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vi.advanceTimersByTime(999);
    expect(cache.get("a")).toBe(1);
    vi.advanceTimersByTime(1);
    expect(cache.get("a")).toBeUndefined();
  });

  it("wrap 首次回源 loader 并写缓存，二次命中不再调 loader", async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    const loader = vi.fn(async () => 42);
    expect(await cache.wrap("a", loader)).toBe(42);
    expect(await cache.wrap("a", loader)).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("wrap 的 loader 异常上抛且不产生缓存条目（失败可重试）", async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    const boom = async (): Promise<number> => {
      throw new Error("boom");
    };
    await expect(cache.wrap("a", boom)).rejects.toThrow("boom");
    expect(cache.size).toBe(0);
    const loader = vi.fn(async () => 7);
    expect(await cache.wrap("a", loader)).toBe(7);
  });

  it("null 值可被缓存命中（博客 404 场景：post: null）", async () => {
    const cache = createTtlCache<{ post: null } | { post: { slug: string } }>({ ttlMs: 1000 });
    const loader1 = vi.fn(async () => ({ post: null }));
    expect(await cache.wrap("missing-slug", loader1)).toEqual({ post: null });
    const loader2 = vi.fn(async () => ({ post: { slug: "x" } }));
    expect(await cache.wrap("missing-slug", loader2)).toEqual({ post: null });
    expect(loader2).not.toHaveBeenCalled();
  });

  it("缓存条目过期后 wrap 重新回源", async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    const loader = vi.fn(async () => 1);
    expect(await cache.wrap("a", loader)).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(await cache.wrap("a", loader)).toBe(1);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("超容量按 FIFO 逐出最旧条目", () => {
    const cache = createTtlCache<number>({ ttlMs: 10_000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("重复 set 同一 key 刷新插入顺序，不被 FIFO 误逐出", () => {
    const cache = createTtlCache<number>({ ttlMs: 10_000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 9);
    cache.set("c", 3);
    expect(cache.get("a")).toBe(9);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("clear 清空全部条目", () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    cache.set("a", 1);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });
});
