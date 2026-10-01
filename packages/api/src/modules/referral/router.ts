import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";
import { paginationSchema } from "../../schema";
import {
  bindReferral,
  getMyReferralStats,
  getOrCreateReferralCode,
  listMyCommissions,
  listMyRelations,
} from "./service";

const bindBody = z.object({ code: z.string().min(1).max(64) });

export const referralRouter = new Hono()
  .get("/referral/me", requireAuth, async (c) => {
    const userId = c.get("userId");
    const [code, stats] = await Promise.all([
      getOrCreateReferralCode(userId),
      getMyReferralStats(userId),
    ]);
    const origin = new URL(c.req.url).origin;
    return c.json(respData({ code, link: `${origin}/register?ref=${code}`, stats }));
  })
  .get("/referral/commissions", requireAuth, zValidator("query", paginationSchema), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const { items, total } = await listMyCommissions({ page, pageSize, userId: c.get("userId") });
    return c.json(respPage(items, total));
  })
  .get("/referral/relations", requireAuth, zValidator("query", paginationSchema), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const { items, total } = await listMyRelations({ page, pageSize, userId: c.get("userId") });
    return c.json(respPage(items, total));
  })
  .post("/referral/bind", requireAuth, zValidator("json", bindBody), async (c) => {
    const { code } = c.req.valid("json");
    const res = await bindReferral({ code, userId: c.get("userId") });
    if (!res.ok) {
      const status =
        res.error === "INVALID_CODE" ? 404 : res.error === "ALREADY_REFERRED" ? 409 : 422;
      return c.json(respErr(res.error ?? "BIND_FAILED"), status);
    }
    return c.json(respData(null));
  });
