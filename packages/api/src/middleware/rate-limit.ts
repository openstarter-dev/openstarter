import { rateLimit as rateLimitTable } from "../db/schema";
import { db } from "../db/server";
import { respErr } from "@openstarter/shared";
import { getUuid } from "@openstarter/shared/id";
import { logger } from "@openstarter/shared/logger";
import { lt, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { readEnv } from "../lib/env";

const MS_PER_SECOND = 1000;
const STATUS_TOO_MANY_REQUESTS = 429;

const RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;

const RATE_LIMIT_SWEEP_PROBABILITY = 0.01;

export interface RateLimitOptions {
  max: number;

  scope: string;

  windowSec: number;
}

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

async function sweepExpiredRows(now: number): Promise<void> {
  await db()
    .delete(rateLimitTable)
    .where(lt(rateLimitTable.lastRequest, now - RATE_LIMIT_RETENTION_MS));
}

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
