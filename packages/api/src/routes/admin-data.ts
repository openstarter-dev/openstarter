// packages/api/src/routes/admin-data —— 管理后台只读列表与邀请码管理（R26.2 / R9.1）。
//
// 补齐 routes/admin.ts（RBAC 角色/权限/用户角色）之外的后台管理端点：
//   - 只读列表：用户、订单、订阅、积分（供 Admin_Console 各账单/用户页展示）；
//   - 邀请码：列出 / 批量生成 / 删除（R9.1）。
//
// 全部挂 `requireAuth + requirePermission("admin.*")`：平台级授权仅由通配符 RBAC 判定
// （授予 `admin.*` 或 `*` 即通行），与 better-auth `organization` 解耦。入参经 `zValidator` 校验。

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

import {
  listCredits,
  listOrders,
  listSubscriptions,
  listUsers,
} from "../admin";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_INVITE_BATCH = 200;
const DEFAULT_TRIAL_DAYS = 15;
const DEFAULT_MAX_USES = 1;

const PERMISSION_ADMIN = "admin.*";

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});

const inviteBatchBody = z.object({
  count: z.number().int().min(1).max(MAX_INVITE_BATCH),
  maxUses: z.number().int().min(1).optional(),
  note: z.string().optional(),
  trialDays: z.number().int().min(0).optional(),
});

const idParam = z.object({ id: z.string().min(1) });

// 站点设置写入：键值对（值为字符串）。Config_Service 内部完成保护键丢弃、掩码跳过、
// 秘密加密与校验（R2.5），此处仅约束形态。
const saveConfigBody = z.record(z.string(), z.string());

export const adminDataRoute = new Hono()
  .get(
    "/api/admin/users",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize, search } = c.req.valid("query");
      const { items, total } = await listUsers({ page, pageSize, search });
      return c.json(respPage(items, total));
    }
  )
  .get(
    "/api/admin/orders",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize, status } = c.req.valid("query");
      const { items, total } = await listOrders({ page, pageSize, status });
      return c.json(respPage(items, total));
    }
  )
  .get(
    "/api/admin/subscriptions",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize, status } = c.req.valid("query");
      const { items, total } = await listSubscriptions({
        page,
        pageSize,
        status,
      });
      return c.json(respPage(items, total));
    }
  )
  .get(
    "/api/admin/credits",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize, status } = c.req.valid("query");
      const { items, total } = await listCredits({ page, pageSize, status });
      return c.json(respPage(items, total));
    }
  )
  .get(
    "/api/admin/invite-codes",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    async (c) => {
      const items = await listInviteCodes();
      return c.json(respData(items));
    }
  )
  .post(
    "/api/admin/invite-codes",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
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
    "/api/admin/invite-codes/:id",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      await deleteInviteCode(id);
      return c.json(respOk());
    }
  )
  // ── 站点设置（Config_Service，R2 / R26.2） ──────────────────────────────────
  .get(
    "/api/admin/config",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    async (c) => {
      const configs = await getAdminConfigs();
      const settings = getSettings();
      const groups = getSettingGroups();
      const tabs = getSettingTabs();
      return c.json(respData({ configs, groups, settings, tabs }));
    }
  )
  .post(
    "/api/admin/config",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("json", saveConfigBody),
    async (c) => {
      const body = c.req.valid("json");
      await saveConfigs(body);
      return c.json(respOk());
    }
  );
