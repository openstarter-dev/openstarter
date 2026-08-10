// packages/api/src/index —— 应用组合根。
//
// 架构：Hono app + basePath("/api") + 模块化路由分组（modules/）。
// 所有模块路由使用相对路径，挂载于 "/" 下（或特定前缀），经 basePath 统一添加 /api 前缀。
// 路由注册顺序（关键）：
//   1. 统一错误处理（app.onError）
//   2. basePath("/api") 作用域
//   3. auth 路由（先于 better-auth wildcard，拦截 unlink-account 的并发绕过）
//   4. Better Auth wildcard catch-all（/api/auth/*）
//   5. 其余功能域路由

import { createAuth } from "@openstarter/auth";
import { respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { registerAiSaveFiles } from "./modules/ai-tasks";
import { adminRouter } from "./modules/admin/router";
import { aiRouter } from "./modules/ai/router";
import { llmRouter } from "./modules/llm";
import { authRouter } from "./modules/auth/router";
import { billingRouter } from "./modules/billing/router";
import { configRouter } from "./modules/config/router";
import { contentRouter } from "./modules/content/router";
import { demoRouter } from "./modules/demo/router";
import { statusRouter } from "./modules/status/router";
import { storageRouter } from "./modules/storage/router";
import { supportRouter } from "./modules/support/router";
import { userRouter } from "./modules/user/router";

// AI 域存储回调接线（R19.1 收尾）：在 api 组合根一次性注入 setSaveFiles，使 AI 生成文件经
// `packages/api/storage` 落对象存储（无渠道走 base64 兜底）。AI 域不直接依赖 storage（经注入）。
registerAiSaveFiles();

const app = new Hono();

// 统一错误处理（R4.4/R4.5）：结构化 `{ code: -1, message }`、记日志、不泄露堆栈。
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    logger.warn(`[api] handled exception (${err.status})`, err.message);
    return c.json(respErr(err.message), err.status);
  }
  logger.error("[api] unhandled error", err);
  return c.json(respErr("Internal Server Error"), 500);
});

// basePath 作用域：以下所有路由经 /api 前缀暴露。
const api = app.basePath("/api");

// 精确拦截原生 unlink-account：条件 DELETE 在数据库语句级维护"至少一个登录方式"不变量，
// 必须先于 Better Auth wildcard 注册，防止并发直接 API 请求绕过。
api.route("/", authRouter);

// better-auth handler（R4.1）：/api/auth/* 其余能力全量委托给 better-auth，
// 现有登录/注册/OAuth/magicLink/emailOTP/passkey/twoFactor/organization 等能力经此 catch-all 暴露。
// 注册在 authRouter 之后，特定路径（unlink-account）优先于通配符。
api.on(["POST", "GET"], "/auth/*", (c) => createAuth().handler(c.req.raw));

// 功能域路由挂载。模块路由使用相对路径，统一经 basePath 添加 /api 前缀。
// 挂载模式：
//   - 无前缀冲突 → 挂载于 "/" 下（路由自含完整路径段）。
//   - 有明确域前缀 → 挂载于该前缀下（如 /admin → admin 域）。
//   - 子域聚合 → 模块内聚合器下设子路由（如 /content/{posts,blog,taxonomy,seo}）。
const routes = api
  .route("/", statusRouter)       // GET /api/health, GET /api/status
  .route("/", configRouter)       // GET /api/config/public, GET /api/analytics/config
  .route("/", userRouter)         // GET /api/user/*, GET/PATCH /api/profile
  .route("/", demoRouter)         // GET /api/private-data, /api/notes*
  .route("/", billingRouter)      // POST /api/checkout, POST /api/payment/webhook/:provider
  .route("/", storageRouter)      // POST /api/storage/upload-image
  .route("/", aiRouter)           // POST/GET /api/ai-tasks, GET /api/ai-tasks/:id
  .route("/", llmRouter)          // POST/GET /api/llm/chats, /api/llm/chats/:id/messages
  .route("/", supportRouter)      // /api/tickets*, /api/apikeys
  .route("/", contentRouter)      // /api/posts*, /api/blog*, /api/taxonomy*, /api/seo*
  .route("/admin", adminRouter);  // /api/admin/*

export { api as app };
export type AppType = typeof routes;