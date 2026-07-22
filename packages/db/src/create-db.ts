import { createD1Db } from "./d1";
import { closeMysqlDb, createMysqlDb } from "./mysql";
import { closePostgresDb, createPostgresDb } from "./postgres";
import { createSqliteDb } from "./sqlite";
import type { Database, DbConfig } from "./types";

type UnknownFunction = (...args: unknown[]) => unknown;
type PayloadContext = { payload?: unknown };

// Proxies are cached per underlying instance so repeated wrapping (e.g. nested
// transactions) reuses the same proxy and preserves identity.
const mysqlCompatCache = new WeakMap<object, object>();
const sqliteCompatCache = new WeakMap<object, object>();

/**
 * MySQL compatibility proxy.
 *
 * MySQL/drizzle has no `.returning()`; this proxy captures the `values`/`set`
 * payload of an `insert`/`update` and replays it when `.returning()` is called.
 * It also adapts `.onConflictDoUpdate({ set })` to `.onDuplicateKeyUpdate`.
 */
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
          const onDuplicate = Reflect.get(
            target,
            "onDuplicateKeyUpdate"
          ) as UnknownFunction;
          return (conflictConfig: unknown): unknown => {
            const set =
              conflictConfig && typeof conflictConfig === "object"
                ? (conflictConfig as { set?: unknown }).set
                : undefined;
            return wrapQuery(onDuplicate.call(target, { set }), ctx);
          };
        }

        if (
          prop === "returning" &&
          typeof Reflect.get(target, "returning") !== "function"
        ) {
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
            ...rest
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
      return (...args: unknown[]): unknown =>
        wrapQuery(method.apply(target, args), {});
    },
  });

  mysqlCompatCache.set(dbInstance, proxied);
  return proxied;
}

/**
 * SQLite / Turso / D1 compatibility proxy.
 *
 * - `.for('update')` (row locking) is polyfilled as a no-op — SQLite
 *   serializes writes so an explicit lock clause is unnecessary.
 * - D1 has no interactive transactions, so `.transaction(cb)` runs the callback
 *   directly against the (proxied) database.
 */
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
        return (...args: unknown[]): unknown =>
          wrapQuery(method.apply(target, args));
      },
    });
  };

  const proxied = new Proxy(dbInstance, {
    get(target, prop, receiver) {
      if (prop === "transaction") {
        if (provider === "d1") {
          return (callback: unknown): unknown =>
            (callback as (tx: unknown) => unknown)(proxied);
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
            ...rest
          );
        };
      }

      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== "function") {
        return value;
      }
      const method = value as UnknownFunction;
      if (typeof prop === "string" && prop.startsWith("select")) {
        return (...args: unknown[]): unknown =>
          wrapQuery(method.apply(target, args));
      }
      return method.bind(target);
    },
  });

  sqliteCompatCache.set(dbInstance, proxied);
  return proxied;
}

/**
 * Multi-dialect connection factory. Dispatches on `config.provider` and wraps
 * the driver result in the matching compatibility proxy so call sites stay
 * dialect-agnostic.
 *
 * An unsupported `provider` throws immediately (R1.4).
 */
export function createDb(config: DbConfig): Database {
  switch (config.provider) {
    case "d1":
      return withSqliteCompat(createD1Db(), "d1");
    case "sqlite":
    case "turso":
      return withSqliteCompat(createSqliteDb(config), config.provider);
    case "mysql":
      return withMysqlCompat(createMysqlDb(config));
    case "postgres":
      return createPostgresDb(config);
    default:
      throw new Error(`Unsupported DATABASE_PROVIDER: ${config.provider}`);
  }
}

/** Close any cached TCP connection for the configured provider (Node only). */
export async function closeDb(config: DbConfig): Promise<void> {
  if (config.provider === "postgres") {
    await closePostgresDb();
    return;
  }
  if (config.provider === "mysql") {
    await closeMysqlDb();
  }
}

export type { Database, DbConfig, DbProvider } from "./types";
