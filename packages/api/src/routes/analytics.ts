// packages/api/src/routes/analytics —— 站点分析路由（Analytics_Module，R25）。
//
// 分为两组，鉴权/授权分别施加：
//   公开路由（无鉴权，只读、非敏感）——
//     - GET /api/analytics/config          分析供应商标识与度量 ID（R25.1/R25.2 数据面），
//       供 apps/web 的 `__root.tsx` 依据其条件注入对应采集脚本；仅下发白名单内的分析键，
//       不含任何敏感配置（对齐「网络暴露提示」：新增公开端点为只读且不含敏感数据）。
//   管理员路由（requireAuth + requirePermission，通配符 RBAC）——
//     - GET /api/admin/analytics/metrics    后台汇总指标（R25.3），供 Admin 首页概览
//       （任务 33.3）消费；平台级授权仅由通配符 RBAC 判定（授予 `analytics.*` 或 `*` 即通行），
//       与 organization 解耦。

import { respData } from "@openstarter/shared";
import { Hono } from "hono";

import { getAdminMetrics, getPublicAnalyticsConfig } from "../analytics";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

// 权限码（`resource.action`）。通配符 RBAC 约定：授予 `analytics.*` 或 `*` 即通行。
const PERMISSION_READ = "analytics.read";

export const analyticsRoute = new Hono()
  // ── 公开路由（只读、非敏感） ──────────────────────────────────────────────
  .get("/api/analytics/config", async (c) => {
    const config = await getPublicAnalyticsConfig();
    return c.json(respData(config));
  })
  // ── 管理员路由（requireAuth + requirePermission，通配符 RBAC） ───────────────
  .get(
    "/api/admin/analytics/metrics",
    requireAuth,
    requirePermission(PERMISSION_READ),
    async (c) => {
      const metrics = await getAdminMetrics();
      return c.json(respData(metrics));
    }
  );
