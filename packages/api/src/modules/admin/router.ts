import { Hono } from "hono";

import { analyticsRouter } from "./analytics/router";
import { adminTicketsRouter } from "./tickets/router";
import { overviewRouter } from "./overview/router";
import { rbacRouter } from "./rbac/router";

// 平台级管理路由聚合器。子路由自身携带各自的鉴权与通配符 RBAC 权限守卫
// （rbac/overview → admin.*，analytics → analytics.read，tickets → ticket.*），
// 此处不再重复施加，保持子路由自包含、可独立测试。
export const adminRouter = new Hono()
  .route("/", rbacRouter)
  .route("/", overviewRouter)
  .route("/analytics", analyticsRouter)
  .route("/tickets", adminTicketsRouter);