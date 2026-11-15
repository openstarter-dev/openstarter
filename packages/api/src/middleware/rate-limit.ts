import { rateLimit as rateLimitTable } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { respErr } from "@openstarter/shared";
import { getUuid } from "@openstarter/shared/id";
import { logger } from "@openstarter/shared/logger";
import { lt, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { readEnv } from "../lib/env";

const MS_PER_SECOND = 1000;
const STATUS_TOO_MANY_REQUESTS = 429;

// Rows whose last hit is older than this can no longer affect any configured window
// (windows in this repo are ≤ 60s); a sweep reclaims them so the table stays bounded.
// 最后命中早于该时长的行已无法影响任何窗口（当前各窗口 ≤ 60s），定期回收防止表无界增长。
const RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;
// Run the sweep on ~1% of requests: amortized cost is negligible on D1.
// 约 1% 的请求顺带执行回收：分摊后对 D1 的额外开销可忽略。
const RATE_LIMIT_SWEEP_PROBABILITY = 0.01;

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  max: number;
  /** Bucket name; keeps different routes from sharing one counter. */
  scope: string;
  /** Fixed window length in seconds. */
  windowSec: number;
}

/**
 * Resolve the caller identity: authenticated user id first, then client IP.
 * 解析调用方标识：优先已认证用户 id，其次客户端 IP（均不可用则不限流）。
 */
function resolveIdentity(userId: string | undefined, headers: Headers): string | undefined {
  if (userId) {
    return `u:${userId}`;
  }
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() ? `ip:${ip.trim()}` : undefined;
}

/**
 * Atomically count one request in the fixed window (single upsert; works on sqlite).
 * 单条 upsert 原子计数一次请求（固定窗口，sqlite / D1 通用）
 */
async function hit(key: string, windowMs: number) {
  const now = Date.now();
  const nowSql = sql`cast(${now} as bigint)`;
  const expired = sql`${nowSql} - ${rateLimitTable.lastRequest} >= ${windowMs}`;

  const [row] = await db()
    .insert(rateLimitTable)
    .values({ count: 1, id: getUuid(), key, lastRequest: now })
    .onConflictDoUpdate({
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimitTable.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${nowSql} else ${rateLimitTable.lastRequest} end`,
      },
      target: rateLimitTable.key,
    })
    .returning({ count: rateLimitTable.count, lastRequest: rateLimitTable.lastRequest });

  return { count: row?.count ?? 1, lastRequest: Number(row?.lastRequest ?? now), now };
}

/**
 * Delete stale rows (also written by better-auth's DB rate limiter, which shares the table).
 * 回收过期行（better-auth 的 DB 限流共用此表，一并覆盖）。
 */
async function sweepExpiredRows(now: number): Promise<void> {
  await db()
    .delete(rateLimitTable)
    .where(lt(rateLimitTable.lastRequest, now - RATE_LIMIT_RETENTION_MS));
}

/**
 * Fixed-window rate limit backed by the shared `rate_limit` table.
 * Mount it after `requireAuth` to limit per user; otherwise it limits per client IP.
 * Fails open on storage errors and is disabled in tests.
 * 基于共享 `rate_limit` 表的固定窗口限流；置于 `requireAuth` 之后按用户限流，否则按 IP。
 * 存储异常时放行（fail-open），测试环境下禁用。
 */
export function rateLimit(options: RateLimitOptions) {
  const windowMs = options.windowSec * MS_PER_SECOND;

  return createMiddleware<{ Variables: { userId?: string } }>(async (c, next) => {
    if (readEnv("NODE_ENV") === "test") {
      await next();
      return;
    }

    const identity = resolveIdentity(c.get("userId"), c.req.raw.headers);
    if (!identity) {
      await next();
      return;
    }

    try {
      const { count, lastRequest, now } = await hit(`api:${options.scope}:${identity}`, windowMs);
      if (Math.random() < RATE_LIMIT_SWEEP_PROBABILITY) {
        await sweepExpiredRows(now).catch((error) => {
          logger.warn("[api] rate limit sweep failed", error);
        });
      }
      if (count > options.max) {
        const retryAfter = Math.max(1, Math.ceil((lastRequest + windowMs - now) / MS_PER_SECOND));
        c.header("Retry-After", String(retryAfter));
        return c.json(respErr("Too many requests"), STATUS_TOO_MANY_REQUESTS);
      }
    } catch (error) {
      logger.warn("[api] rate limit check failed, allowing request", error);
    }

    await next();
  });
}
