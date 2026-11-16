import { zValidator as honoZValidator } from "@hono/zod-validator";
import { respErr } from "@openstarter/shared";
import type { Context, MiddlewareHandler } from "hono";

const defaultHook = (
  result: { error?: unknown; success: boolean },
  c: Context,
): Response | undefined => {
  if (!result.success) {
    const fields = (result.error as { flatten?: () => unknown } | undefined)?.flatten?.();
    return c.json({ ...respErr("invalid request"), data: { fields } }, 400);
  }
};

type RunValidator = (
  target: unknown,
  schema: unknown,
  hook?: unknown,
  options?: unknown,
) => MiddlewareHandler;

export const zValidator = ((target: unknown, schema: unknown, hook?: unknown, options?: unknown) =>
  (honoZValidator as unknown as RunValidator)(
    target,
    schema,
    hook ?? defaultHook,
    options,
  )) as typeof honoZValidator;
