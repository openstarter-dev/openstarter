import { createAuth } from "@openstarter/auth";
import { respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { registerAiSaveFiles } from "./modules/ai/tasks";
import { adminRouter } from "./modules/admin/router";
import { referralRouter } from "./modules/referral";
import { aiModelsRouter } from "./modules/ai/catalog/router";
import { aiRouter } from "./modules/ai/media/router";
import { llmRouter } from "./modules/ai/llm";
import { billingRouter } from "./modules/billing/router";
import { configRouter } from "./modules/config/router";
import { contentRouter } from "./modules/content/router";
import { demoRouter } from "./modules/demo/router";
import { mcpRouter } from "./modules/mcp";
import { statusRouter } from "./modules/status/router";
import { storageRouter } from "./modules/storage/router";
import { supportRouter } from "./modules/support/router";
import { userRouter } from "./modules/user/router";

registerAiSaveFiles();

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    logger.warn(`[api] handled exception (${err.status})`, err.message);
    return c.json(respErr(err.message), err.status);
  }
  logger.error("[api] unhandled error", err);
  return c.json(respErr("Internal Server Error"), 500);
});

const api = app.basePath("/api");

api.on(["POST", "GET"], "/auth/*", (c) => createAuth().handler(c.req.raw));

const routes = api
  .route("/", statusRouter)
  .route("/", configRouter)
  .route("/", userRouter)
  .route("/", demoRouter)
  .route("/", billingRouter)
  .route("/", storageRouter)
  .route("/", aiRouter)
  .route("/", llmRouter)
  .route("/", aiModelsRouter)
  .route("/", supportRouter)
  .route("/", contentRouter)
  .route("/", referralRouter)
  .route("/mcp", mcpRouter)
  .route("/admin", adminRouter);

export { api as app };
export type AppType = typeof routes;
