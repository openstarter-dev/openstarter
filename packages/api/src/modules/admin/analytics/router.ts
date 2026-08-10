import { respData } from "@openstarter/shared";
import { Hono } from "hono";

import { getAdminMetrics } from "./service";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";

const PERMISSION_READ = "analytics.read";

export const analyticsRouter = new Hono()
  .use(requireAuth)
  .use(requirePermission(PERMISSION_READ))
  .get("/metrics", async (c) => {
    const metrics = await getAdminMetrics();
    return c.json(respData(metrics));
  });