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
