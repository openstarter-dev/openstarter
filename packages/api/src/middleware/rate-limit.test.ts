import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@openstarter/shared/logger";
import { rateLimit } from "./rate-limit";

const state = vi.hoisted(() => ({
  database: undefined as Record<string, unknown> | undefined,
  nodeEnv: "production",
}));

vi.mock("../lib/env", () => ({
  readEnv: vi.fn(() => state.nodeEnv),
}));

vi.mock("../db/server", () => ({
  db: () => state.database,
}));

vi.mock("@openstarter/shared/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const FIXED_NOW = 1_700_000_000_000;

interface HitResult {
  count: number;
  lastRequest: number;
}

interface MakeDatabaseOptions {
  failDelete?: boolean;
  failInsert?: boolean;
  hit?: HitResult;
}

function makeDatabase(options: MakeDatabaseOptions = {}) {
  const valuesRows: Array<Record<string, unknown>> = [];
  const insert = vi.fn(() => {
    if (options.failInsert) {
      throw new Error("db down");
    }
    return {
      values: (row: Record<string, unknown>) => {
        valuesRows.push(row);
        return {
          onConflictDoUpdate: () => ({
            returning: async () => [options.hit ?? { count: 1, lastRequest: FIXED_NOW }],
          }),
        };
      },
    };
  });
  const deleteFn = vi.fn(() => {
    if (options.failDelete) {
      throw new Error("db down");
    }
    return { where: async () => undefined };
  });
  return { delete: deleteFn, insert, valuesRows };
}

function buildApp(
  middleware: ReturnType<typeof rateLimit>,
  handler: () => Response,
  options: { userId?: string } = {},
) {
  const app = new Hono<{ Variables: { userId?: string } }>();
  if (options.userId !== undefined) {
    app.use("*", async (context, next) => {
      context.set("userId", options.userId);
      await next();
    });
  }
  app.use("*", middleware);
  app.get("/limited", handler);
  return app;
}

const okHandler = () => Response.json({ ok: true });

let randomSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
  randomSpy?.mockRestore();
  vi.useRealTimers();
  state.nodeEnv = "production";
  state.database = undefined;
  vi.mocked(logger.warn).mockClear();
});

describe("rate limit middleware", () => {
  it("NODE_ENV=test 时直接放行且不触碰数据库", async () => {
    state.nodeEnv = "test";
    const database = makeDatabase();
    state.database = database as unknown as Record<string, unknown>;

    const response = await buildApp(
      rateLimit({ max: 1, scope: "s", windowSec: 60 }),
      okHandler,
    ).request("/limited");

    expect(response.status).toBe(200);
    expect(database.insert).not.toHaveBeenCalled();
  });

  it("窗口内计数未超限 → 放行", async () => {
    state.database = makeDatabase({
      hit: { count: 1, lastRequest: FIXED_NOW },
    }) as unknown as Record<string, unknown>;

    const response = await buildApp(rateLimit({ max: 20, scope: "s", windowSec: 60 }), okHandler, {
      userId: "user-1",
    }).request("/limited");

    expect(response.status).toBe(200);
  });

  it("计数超限 → 429 + Retry-After，且不执行路由处理", async () => {
    const handler = vi.fn(okHandler);
    state.database = makeDatabase({
      hit: { count: 21, lastRequest: FIXED_NOW - 5_000 },
    }) as unknown as Record<string, unknown>;

    const response = await buildApp(rateLimit({ max: 20, scope: "s", windowSec: 60 }), handler, {
      userId: "user-1",
    }).request("/limited");

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("55");
    expect(handler).not.toHaveBeenCalled();
  });

  it("无身份（未登录且无 IP 头）→ 不限流直接放行", async () => {
    const database = makeDatabase();
    state.database = database as unknown as Record<string, unknown>;

    const response = await buildApp(
      rateLimit({ max: 1, scope: "s", windowSec: 60 }),
      okHandler,
    ).request("/limited");

    expect(response.status).toBe(200);
    expect(database.insert).not.toHaveBeenCalled();
  });

  it("已认证用户以 `u:<userId>` 作为限流身份", async () => {
    const database = makeDatabase();
    state.database = database as unknown as Record<string, unknown>;

    const app = new Hono<{ Variables: { userId?: string } }>();
    app.use("*", async (context, next) => {
      context.set("userId", "user-1");
      await next();
    });
    app.use("*", rateLimit({ max: 20, scope: "scope-d", windowSec: 60 }));
    app.get("/limited", (context) => context.json({ ok: true }));

    const response = await app.request("/limited");

    expect(response.status).toBe(200);
    expect(database.valuesRows[0]?.key).toBe("api:scope-d:u:user-1");
  });

  it("匿名请求回退到客户端 IP 作为限流身份", async () => {
    const database = makeDatabase();
    state.database = database as unknown as Record<string, unknown>;

    const response = await buildApp(
      rateLimit({ max: 20, scope: "scope-e", windowSec: 60 }),
      okHandler,
    ).request("/limited", { headers: { "cf-connecting-ip": "203.0.113.9" } });

    expect(response.status).toBe(200);
    expect(database.valuesRows[0]?.key).toBe("api:scope-e:ip:203.0.113.9");
  });

  it("存储异常时 fail-open 放行并记录告警", async () => {
    state.database = makeDatabase({ failInsert: true }) as unknown as Record<string, unknown>;

    const response = await buildApp(rateLimit({ max: 1, scope: "s", windowSec: 60 }), okHandler, {
      userId: "user-1",
    }).request("/limited");

    expect(response.status).toBe(200);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("概率回收命中时清理过期行；回收失败不影响放行", async () => {
    randomSpy?.mockReturnValue(0);

    const database = makeDatabase();
    state.database = database as unknown as Record<string, unknown>;
    const okResponse = await buildApp(
      rateLimit({ max: 20, scope: "s", windowSec: 60 }),
      okHandler,
      {
        userId: "user-1",
      },
    ).request("/limited");
    expect(okResponse.status).toBe(200);
    expect(database.delete).toHaveBeenCalledTimes(1);

    state.database = makeDatabase({ failDelete: true }) as unknown as Record<string, unknown>;
    const responseAfterFailure = await buildApp(
      rateLimit({ max: 20, scope: "s", windowSec: 60 }),
      okHandler,
      { userId: "user-1" },
    ).request("/limited");
    expect(responseAfterFailure.status).toBe(200);
  });
});
