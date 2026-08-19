/**
 * SQLite / Turso / D1 compatibility proxy.
 *
 * - `.for('update')` (row locking) is polyfilled as a no-op — SQLite
 *   serializes writes so an explicit lock clause is unnecessary.
 * - D1 has no interactive transactions, so `.transaction(cb)` runs the callback
 *   directly against the (proxied) database.
 */

type UnknownFunction = (...args: unknown[]) => unknown;

// Proxies are cached per underlying instance so repeated wrapping (e.g. nested
// transactions) reuses the same proxy and preserves identity.
const sqliteCompatCache = new WeakMap<object, object>();

function withSqliteCompat<T extends object>(dbInstance: T, provider?: string): T {
  const cached = sqliteCompatCache.get(dbInstance);
  if (cached) {
    return cached as T;
  }

  const wrapQuery = (query: unknown): unknown => {
    if (!query || typeof query !== "object") {
      return query;
    }

    return new Proxy(query, {
      get(target, prop, receiver) {
        if (prop === "for" && typeof Reflect.get(target, "for") !== "function") {
          return () => receiver;
        }
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (typeof value !== "function") {
          return value;
        }
        const method = value as UnknownFunction;
        return (...args: unknown[]): unknown => wrapQuery(method.apply(target, args));
      },
    });
  };

  const proxied = new Proxy(dbInstance, {
    get(target, prop, receiver) {
      if (prop === "transaction") {
        if (provider === "d1") {
          return (callback: unknown): unknown => (callback as (tx: unknown) => unknown)(proxied);
        }
        const original = Reflect.get(target, prop, receiver) as unknown;
        if (typeof original !== "function") {
          return original;
        }
        const runTransaction = original as UnknownFunction;
        return (callback: unknown, ...rest: unknown[]): unknown => {
          const userCallback = callback as (tx: unknown) => unknown;
          return runTransaction.call(
            target,
            (tx: object) => userCallback(withSqliteCompat(tx, provider)),
            ...rest,
          );
        };
      }

      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== "function") {
        return value;
      }
      const method = value as UnknownFunction;
      if (typeof prop === "string" && prop.startsWith("select")) {
        return (...args: unknown[]): unknown => wrapQuery(method.apply(target, args));
      }
      return method.bind(target);
    },
  });

  sqliteCompatCache.set(dbInstance, proxied);
  return proxied;
}

export { withSqliteCompat };
