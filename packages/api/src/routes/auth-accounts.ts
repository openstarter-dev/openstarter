import { createAuth } from "@openstarter/auth";
import {
  AccountUnlinkError,
  unlinkAccountSafely,
} from "@openstarter/auth/accounts/unlink";
import { Hono } from "hono";
import { z } from "zod";

const unlinkAccountSchema = z
  .object({
    accountId: z.string().min(1).optional(),
    providerId: z.string().min(1),
  })
  .strict();

const UNLINK_ACCOUNT_PATHS = [
  "/api/auth/unlink-account",
  "/api/auth/unlink-account/",
  "/api/auth//unlink-account",
];

export const authAccountRoute = new Hono().on(
  "POST",
  UNLINK_ACCOUNT_PATHS,
  async (c) => {
    const session = await createAuth().api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session?.user) {
      return c.json(
        { code: "UNAUTHORIZED", message: "Authentication required" },
        401
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ code: "INVALID_BODY", message: "Invalid request" }, 400);
    }
    const parsed = unlinkAccountSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ code: "INVALID_BODY", message: "Invalid request" }, 400);
    }

    try {
      await unlinkAccountSafely({
        ...parsed.data,
        userId: session.user.id,
      });
      return c.json({ status: true });
    } catch (error) {
      if (error instanceof AccountUnlinkError) {
        return c.json({ code: error.code, message: error.message }, 400);
      }
      throw error;
    }
  }
);
