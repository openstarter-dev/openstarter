// 进程内 TTL 缓存（服务端专用）。
//
// 为博客 SSR server fn 等低频变更数据挡住重复回源查询：TTL 命中期内同一 key 直接
// 返回缓存副本。语义有意保持精简（勿扩展成通用缓存库）：
//   - 惰性过期：get 时检查 expiresAt，过期即删并视为未命中；
//   - 容量上限：超限按插入顺序逐出最旧条目（FIFO 而非 LRU——目的是防无限增长，
//     不追求最优逐出）；
//   - loader 异常不缓存：wrap() 让错误自然上抛，失败请求不产生缓存条目；
//   - 不支持缓存 undefined 值（wrap 视 undefined 为未命中，与「无值」歧义）；
//   - 无并发去重：同 key 并发未命中各自回源（SSR 场景每请求 key 基本不同，
//     引入 inflight 表不值得）。
// Workers 上每个 isolate 各自持有缓存，语义为「最终 TTL 内一致」，非强一致。

export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  wrap(key: string, loader: () => Promise<V>): Promise<V>;
  readonly size: number;
  clear(): void;
}

interface Entry<V> {
  expiresAt: number;
  value: V;
}

export function createTtlCache<V>(options: { ttlMs: number; maxEntries?: number }): TtlCache<V> {
  const { ttlMs } = options;
  const maxEntries = options.maxEntries ?? 128;
  const entries = new Map<string, Entry<V>>();

  function get(key: string): V | undefined {
    const entry = entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: string, value: V): void {
    // 已存在的 key 重置为新条目（同时刷新其在 Map 中的插入顺序，FIFO 逐出更公平）。
    if (entries.has(key)) {
      entries.delete(key);
    }
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done) {
        break;
      }
      entries.delete(oldest.value);
    }
  }

  async function wrap(key: string, loader: () => Promise<V>): Promise<V> {
    const cached = get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await loader();
    set(key, value);
    return value;
  }

  return {
    get,
    set,
    wrap,
    get size() {
      return entries.size;
    },
    clear: () => {
      entries.clear();
    },
  };
}
