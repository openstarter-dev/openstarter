import { createAuth } from "@openstarter/auth";
import { respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import { adminRouter } from "./modules/admin/router";
import { referralRouter } from "./modules/referral";
import { billingRouter } from "./modules/billing/router";
import { contentRouter } from "./modules/content/router";
import { demoRouter } from "./modules/demo/router";
import { mcpRouter } from "./modules/mcp";
import { statusRouter } from "./modules/status/router";
import { storageRouter } from "./modules/storage/router";
import { supportRouter } from "./modules/support/router";
import { userRouter } from "./modules/user/router";

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    logger.warn(`[api] handled exception (${err.status})`, err.message);
    return c.json(respErr(err.message), err.status);
  }
  logger.error("[api] unhandled error", err);
  return c.json(respErr("Internal Server Error"), 500);
});

app.notFound((c) => c.json(respErr("not found"), 404));

const api = app.basePath("/api");

// Baseline hardening for every API response: request id for tracing + standard security headers.
// CORP/COOP are disabled so cross-origin clients (extension, mobile webviews) keep working.
// 所有 API 响应的基础加固：请求 id 便于追踪 + 标准安全头；关闭 CORP/COOP 以兼容跨域客户端
api.use("*", requestId());
api.use("*", secureHeaders({ crossOriginOpenerPolicy: false, crossOriginResourcePolicy: false }));

api.on(["POST", "GET"], "/auth/*", (c) => createAuth().handler(c.req.raw));

const routes = api
  .route("/", statusRouter)
  .route("/", userRouter)
  .route("/", demoRouter)
  .route("/", billingRouter)
  .route("/", storageRouter)
  .route("/", supportRouter)
  .route("/", contentRouter)
  .route("/", referralRouter)
  .route("/mcp", mcpRouter)
  .route("/admin", adminRouter);

export { api as app };
export type AppType = typeof routes;
