import { createAuth } from "@openstarter/auth";
import { respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { registerAiSaveFiles } from "./ai-tasks";
import { adminRoute } from "./routes/admin";
import { adminDataRoute } from "./routes/admin-data";
import { aiTasksRoute } from "./routes/ai-tasks";
import { analyticsRoute } from "./routes/analytics";
import { apikeysRoute } from "./routes/apikeys";
import { authAccountRoute } from "./routes/auth-accounts";
import { blogRoute } from "./routes/blog";
import { checkoutRoute } from "./routes/checkout";
import { configRoute } from "./routes/config";
import { healthRoute } from "./routes/health";
import { postsRoute } from "./routes/posts";
import { privateDataRoute } from "./routes/private-data";
import { notesRoute } from "./routes/notes";
import { profileRoute } from "./routes/profile";
import { seoRoute } from "./routes/seo";
import { statusRoute } from "./routes/status";
import { storageRoute } from "./routes/storage";
import { taxonomyRoute } from "./routes/taxonomy";
import { ticketsRoute } from "./routes/tickets";
import { userRoute } from "./routes/user";
import { webhookRoute } from "./routes/webhook";

// AI 域存储回调接线（R19.1 收尾）：在 api 组合根一次性注入 setSaveFiles，使 AI 生成文件经
// `packages/api/storage` 落对象存储（无渠道走 base64 兜底）。AI 域不直接依赖 storage（经注入）。
registerAiSaveFiles();

const app = new Hono();

// 统一错误处理（R4.4/R4.5）：结构化 `{ code: -1, message }`、记日志、不泄露堆栈。
// - HTTPException：沿用其状态码与可读消息（路由/中间件显式抛出的预期错误）。
// - 其余未预期错误：服务端记录完整错误，客户端仅得通用消息 + 500，避免泄露内部实现/堆栈。
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    logger.warn(`[api] handled exception (${err.status})`, err.message);
    return c.json(respErr(err.message), err.status);
  }
  logger.error("[api] unhandled error", err);
  return c.json(respErr("Internal Server Error"), 500);
});

// 精确拦截原生 unlink-account：条件 DELETE 在数据库语句级维护“至少一个登录方式”不变量，
// 必须先于 Better Auth wildcard 注册，防止并发直接 API 请求绕过。
app.route("/", authAccountRoute);

// better-auth handler（R4.1）：/api/auth/* 其余能力全量委托给 better-auth，
// 现有登录/注册/OAuth/magicLink/emailOTP/passkey/twoFactor/organization 等能力经此 catch-all 暴露。
app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));

// 域路由挂载约定（可扩展）：后续阶段的能力域路由在此以 `.route("/", xxxRoute)` 链式追加，
// 计划包含 config / user / apikeys / credits / invite-codes / payment / storage / content /
// tickets / ai-tasks / seo / analytics / admin（随各自阶段落地，并按需施加 requireAuth /
// requirePermission 中间件）。阶段 1 已挂载 config（公开配置）与 apikeys（会话/API Key 鉴权）；
// 阶段 2 追加 checkout（结账，requireAuth）与 payment webhook（渠道回调，靠验签而非会话鉴权）；
// 阶段 3 追加 taxonomy（分类管理）与 posts（文章管理），均 requireAuth + requirePermission 通配符 RBAC；
// 并追加 storage（图片上传，requireAuth：会话或有效 API Key，不接受匿名上传）；
// 以及 blog（面向读者的公开只读博客展示，无鉴权、仅暴露已发布内容）。
// 阶段 4 追加 ai-tasks（AI 任务与积分联动，requireAuth：会话或有效 API Key）；
// 以及 tickets（工单客服）：用户路由 requireAuth（创建/我的/回复本人），管理员路由
// requireAuth + requirePermission(ticket.*) 通配符 RBAC（列出全部/回复任意/改状态），访问隔离。
// 阶段 5 追加 seo（SEO 数据面：已发布文章摘要/全文，公开只读、仅已发布，供 apps/web 端点渲染）；
// 以及 analytics（站点分析）：公开只读的分析配置端点（供 apps/web 条件注入采集脚本，R25.1/R25.2）
// 与管理员汇总指标端点（requireAuth + requirePermission，通配符 RBAC，供 Admin 首页概览，R25.3）。
const routes = app
  .route("/", healthRoute)
  .route("/", privateDataRoute)
  .route("/", configRoute)
  .route("/", apikeysRoute)
  .route("/", checkoutRoute)
  .route("/", webhookRoute)
  .route("/", taxonomyRoute)
  .route("/", postsRoute)
  .route("/", blogRoute)
  .route("/", storageRoute)
  .route("/", aiTasksRoute)
  .route("/", ticketsRoute)
  .route("/", userRoute)
  .route("/", profileRoute)
  .route("/", notesRoute)
  .route("/", statusRoute)
  .route("/", seoRoute)
  .route("/", analyticsRoute)
  .route("/", adminRoute)
  .route("/", adminDataRoute);

export { app };
export type AppType = typeof routes;
