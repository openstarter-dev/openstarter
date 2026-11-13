import { zValidator as honoZValidator } from "@hono/zod-validator";
import { respErr } from "@openstarter/shared";
import type { Context, MiddlewareHandler } from "hono";

function rejectInvalid(c: Context, error: unknown): Response {
  const fields = (error as { flatten?: () => unknown } | undefined)?.flatten?.();
  return c.json({ ...respErr("invalid request"), data: { fields } }, 400);
}

const defaultHook = (
  result: { error?: unknown; success: boolean },
  c: Context,
): Response | undefined => {
  if (!result.success) {
    return rejectInvalid(c, result.error);
  }
};

type RunValidator = (
  target: unknown,
  schema: unknown,
  hook?: unknown,
  options?: unknown,
) => MiddlewareHandler;

/**
 * Workspace-wide zValidator. Uses the API response envelope for validation
 * failures instead of @hono/zod-validator's default { success, error } shape.
 */
export const zValidator = ((target: unknown, schema: unknown, hook?: unknown, options?: unknown) =>
  (honoZValidator as unknown as RunValidator)(
    target,
    schema,
    hook ?? defaultHook,
    options,
  )) as typeof honoZValidator;
