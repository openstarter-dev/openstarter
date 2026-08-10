import { zValidator } from "@hono/zod-validator";
import {
  createInviteCodesBatch,
  deleteInviteCode,
  listInviteCodes,
} from "@openstarter/auth";
import { respData, respOk, respPage } from "@openstarter/shared";
import {
  getAdminConfigs,
  getSettingGroups,
  getSettings,
  getSettingTabs,
  saveConfigs,
} from "@openstarter/shared/config";
import { Hono } from "hono";
import { z } from "zod";

import { idParam, paginationSchema } from "../../../schema";
import {
  listCredits,
  listOrders,
  listSubscriptions,
  listUsers,
} from "../index";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";

const MAX_INVITE_BATCH = 200;
const DEFAULT_TRIAL_DAYS = 15;
const DEFAULT_MAX_USES = 1;

const PERMISSION_ADMIN = "admin.*";

const listQuery = paginationSchema.extend({
  search: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});

const inviteBatchBody = z.object({
  count: z.number().int().min(1).max(MAX_INVITE_BATCH),
  maxUses: z.number().int().min(1).optional(),
  note: z.string().optional(),
  trialDays: z.number().int().min(0).optional(),
});

const saveConfigBody = z.record(z.string(), z.string());

export const overviewRouter = new Hono()
  .use(requireAuth)
  .use(requirePermission(PERMISSION_ADMIN))
  // ── 数据列表 ──────────────────────────────────────────────────────────────────
  .get("/users", zValidator("query", listQuery), async (c) => {
    const { page, pageSize, search } = c.req.valid("query");
    const { items, total } = await listUsers({ page, pageSize, search });
    return c.json(respPage(items, total));
  })
  .get("/orders", zValidator("query", listQuery), async (c) => {
    const { page, pageSize, status } = c.req.valid("query");
    const { items, total } = await listOrders({ page, pageSize, status });
    return c.json(respPage(items, total));
  })
  .get("/subscriptions", zValidator("query", listQuery), async (c) => {
    const { page, pageSize, status } = c.req.valid("query");
    const { items, total } = await listSubscriptions({ page, pageSize, status });
    return c.json(respPage(items, total));
  })
  .get("/credits", zValidator("query", listQuery), async (c) => {
    const { page, pageSize, status } = c.req.valid("query");
    const { items, total } = await listCredits({ page, pageSize, status });
    return c.json(respPage(items, total));
  })
  // ── 邀请码管理 ────────────────────────────────────────────────────────────────
  .get("/invite-codes", async (c) => {
    const items = await listInviteCodes();
    return c.json(respData(items));
  })
  .post(
    "/invite-codes",
    zValidator("json", inviteBatchBody),
    async (c) => {
      const body = c.req.valid("json");
      const created = await createInviteCodesBatch({
        count: body.count,
        createdBy: c.get("userId"),
        maxUses: body.maxUses ?? DEFAULT_MAX_USES,
        note: body.note,
        trialDays: body.trialDays ?? DEFAULT_TRIAL_DAYS,
      });
      return c.json(respData(created));
    }
  )
  .delete(
    "/invite-codes/:id",
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      await deleteInviteCode(id);
      return c.json(respOk());
    }
  )
  // ── 站点设置（Config_Service） ────────────────────────────────────────────────
  .get("/config", async (c) => {
    const configs = await getAdminConfigs();
    const settings = getSettings();
    const groups = getSettingGroups();
    const tabs = getSettingTabs();
    return c.json(respData({ configs, groups, settings, tabs }));
  })
  .post(
    "/config",
    zValidator("json", saveConfigBody),
    async (c) => {
      const body = c.req.valid("json");
      await saveConfigs(body);
      return c.json(respOk());
    }
  );