import { Hono } from "hono";

// 注意：必须引入 adminAiModelsRouter（admin CRUD 子路由），而非同文件的 aiModelsRouter（前台门面）。
// Task 10 发现此前的别名导入挂错对象，导致 /api/admin/ai-models 实际暴露的是门面分组目录（仅 GET）。
import { adminAiModelsRouter } from "../ai/catalog/router";
import { referralAdminRouter } from "./referral/router";
import { analyticsRouter } from "./analytics/router";
import { adminTicketsRouter } from "./tickets/router";
import { overviewRouter } from "./overview/router";

// 平台级管理路由聚合器。子路由自身携带各自的鉴权与权限守卫
// （overview → admin.*，analytics → analytics.read，tickets → ticket.*），
// 此处不再重复施加，保持子路由自包含、可独立测试。
//
// 角色/权限 CRUD 已移除：角色由代码内 ROLE_PERMISSIONS 定义，用户角色经
// better-auth admin 插件（/api/auth/admin/set-role）写入 `user.role`。
export const adminRouter = new Hono()
  .route("/", overviewRouter)
  .route("/analytics", analyticsRouter)
  .route("/tickets", adminTicketsRouter)
  .route("/ai-models", adminAiModelsRouter)
  .route("/referral", referralAdminRouter);
