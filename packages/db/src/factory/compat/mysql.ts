/**
 * MySQL compatibility proxy.
 *
 * MySQL/drizzle has no `.returning()`; this proxy captures the `values`/`set`
 * payload of an `insert`/`update` and replays it when `.returning()` is called.
 * It also adapts `.onConflictDoUpdate({ set })` to `.onDuplicateKeyUpdate`.
 */

type UnknownFunction = (...args: unknown[]) => unknown;
type PayloadContext = { payload?: unknown };

// Proxies are cached per underlying instance so repeated wrapping (e.g. nested
// transactions) reuses the same proxy and preserves identity.
const mysqlCompatCache = new WeakMap<object, object>();

function withMysqlCompat<T extends object>(dbInstance: T): T {
  const cached = mysqlCompatCache.get(dbInstance);
  if (cached) {
    return cached as T;
  }

  const wrapQuery = (query: unknown, ctx: PayloadContext): unknown => {
    if (!query || typeof query !== "object") {
      return query;
    }

    return new Proxy(query, {
      get(target, prop, receiver) {
        if (
          prop === "onConflictDoUpdate" &&
          typeof Reflect.get(target, "onConflictDoUpdate") !== "function" &&
          typeof Reflect.get(target, "onDuplicateKeyUpdate") === "function"
        ) {
          const onDuplicate = Reflect.get(target, "onDuplicateKeyUpdate") as UnknownFunction;
          return (conflictConfig: unknown): unknown => {
            const set =
              conflictConfig && typeof conflictConfig === "object"
                ? (conflictConfig as { set?: unknown }).set
                : undefined;
            return wrapQuery(onDuplicate.call(target, { set }), ctx);
          };
        }

        if (prop === "returning" && typeof Reflect.get(target, "returning") !== "function") {
          return async (): Promise<unknown[]> => {
            await (target as unknown as PromiseLike<unknown>);
            if (ctx.payload === undefined) {
              return [];
            }
            return Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload];
          };
        }

        const value = Reflect.get(target, prop, receiver) as unknown;
        if (typeof value !== "function") {
          return value;
        }
        const method = value as UnknownFunction;
        return (...args: unknown[]): unknown => {
          if (prop === "values" || prop === "set") {
            ctx.payload = args[0];
          }
          return wrapQuery(method.apply(target, args), ctx);
        };
      },
    });
  };

  const proxied = new Proxy(dbInstance, {
    get(target, prop, receiver) {
      if (prop === "transaction") {
        const original = Reflect.get(target, prop, receiver) as unknown;
        if (typeof original !== "function") {
          return original;
        }
        const runTransaction = original as UnknownFunction;
        return (callback: unknown, ...rest: unknown[]): unknown => {
          const userCallback = callback as (tx: unknown) => unknown;
          return runTransaction.call(
            target,
            (tx: object) => userCallback(withMysqlCompat(tx)),
            ...rest,
          );
        };
      }

      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== "function") {
        return value;
      }
      const method = value as UnknownFunction;
      if (prop !== "insert" && prop !== "update" && prop !== "delete") {
        return method.bind(target);
      }
      return (...args: unknown[]): unknown => wrapQuery(method.apply(target, args), {});
    },
  });

  mysqlCompatCache.set(dbInstance, proxied);
  return proxied;
}

export { withMysqlCompat };
