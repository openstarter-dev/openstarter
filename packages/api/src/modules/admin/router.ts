import { Hono } from "hono";

import { adminAiModelsRouter } from "../ai/catalog/router";
import { referralAdminRouter } from "./referral/router";
import { analyticsRouter } from "./analytics/router";
import { adminTicketsRouter } from "./tickets/router";
import { overviewRouter } from "./overview/router";

export const adminRouter = new Hono()
  .route("/", overviewRouter)
  .route("/analytics", analyticsRouter)
  .route("/tickets", adminTicketsRouter)
  .route("/ai-models", adminAiModelsRouter)
  .route("/referral", referralAdminRouter);
