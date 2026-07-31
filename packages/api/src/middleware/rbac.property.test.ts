import fc from "fast-check";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { describe, expect, it, vi } from "vitest";

import { createRequirePermission } from "./rbac";

const SEGMENT_PATTERN = /^[a-z][a-z0-9_-]{0,11}$/;
const segmentArbitrary = fc.stringMatching(SEGMENT_PATTERN);

describe("RBAC middleware properties", () => {
  it("exposes an injectable platform-permission resolver seam", () => {
    expect(createRequirePermission).toBeTypeOf("function");
  });

  it("P6 insufficient permission rejects with 403", async () => {
    await fc.assert(
      fc.asyncProperty(
        segmentArbitrary,
        segmentArbitrary,
        fc.array(segmentArbitrary, { maxLength: 8 }),
        async (resource, action, unrelatedActions) => {
          const requiredPermission = `${resource}.${action}`;
          const deniedCodes = unrelatedActions.map(
            (unrelatedAction) => `other_${resource}.${unrelatedAction}`
          );
          const routeHandler = vi.fn((context) => context.json({ ok: true }));
          const app = new Hono<{ Variables: { userId: string } }>();

          app.use(
            "*",
            createMiddleware<{ Variables: { userId: string } }>(
              async (context, next) => {
                context.set("userId", "user-1");
                await next();
              }
            )
          );
          app.get(
            "/protected",
            createRequirePermission(requiredPermission, (_userId) =>
              Promise.resolve(deniedCodes)
            ),
            routeHandler
          );

          const response = await app.request("/protected");

          expect(response.status).toBe(403);
          expect(routeHandler).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
