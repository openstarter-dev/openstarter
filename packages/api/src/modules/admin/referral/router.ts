import { respData, respErr, respOk, respPage } from "@openstarter/shared";
import { Hono } from "hono";

import { zValidator } from "../../../lib/validator";
import { idParam, paginationSchema } from "../../../schema";
import { commissionsQuery, manualCreateBody, rateBody } from "../../../schema/admin/referral";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";

import {
  getReferralConfigForAdmin,
  listCommissions,
  listRelations,
  manualCreateCommission,
  setCustomRate,
  settleCommission,
  voidCommission,
} from "./service";

const PERMISSION_ADMIN = "admin.*";

export const referralAdminRouter = new Hono()
  .use(requireAuth)
  .use(requirePermission(PERMISSION_ADMIN))

  .get("/config", async (c) => {
    const result = await getReferralConfigForAdmin();
    return c.json(respData(result.data));
  })

  .get("/commissions", zValidator("query", commissionsQuery), async (c) => {
    const { page, pageSize, status } = c.req.valid("query");
    const { items, total } = await listCommissions({ page, pageSize, status });
    return c.json(respPage(items, total));
  })
  .post("/commissions/:id/settle", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const adminUserId = c.get("userId");
    const result = await settleCommission({ adminUserId, commissionId: id });
    if (result.error === "NOT_FOUND") {
      return c.json(respErr("not_found"), 404);
    }
    if (result.error === "NOT_PENDING") {
      return c.json(respErr("NOT_PENDING"), 409);
    }
    if (result.error === "GRANT_FAILED") {
      return c.json(respErr("grant_failed"), 500);
    }
    return c.json(respData({ transactionNo: result.transactionNo }));
  })
  .post("/commissions/:id/void", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const result = await voidCommission({ commissionId: id });
    if (result.error === "NOT_FOUND") {
      return c.json(respErr("not_found"), 404);
    }
    if (result.error === "NOT_PENDING") {
      return c.json(respErr("NOT_PENDING"), 409);
    }
    return c.json(respOk());
  })
  .post("/commissions", zValidator("json", manualCreateBody), async (c) => {
    const body = c.req.valid("json");
    const result = await manualCreateCommission(body);
    return c.json(respData(result.data));
  })

  .get("/relations", zValidator("query", paginationSchema), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const { items, total } = await listRelations({ page, pageSize });
    return c.json(respPage(items, total));
  })

  .put("/users/:id/rate", zValidator("param", idParam), zValidator("json", rateBody), async (c) => {
    const { id } = c.req.valid("param");
    const { customRate } = c.req.valid("json");
    await setCustomRate({ userId: id, customRate });
    return c.json(respOk());
  });
