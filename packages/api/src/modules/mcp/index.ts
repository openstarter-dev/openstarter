import { Hono } from "hono";

import { apiKeyAuth } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rate-limit";
import { mcpHandler } from "./server";

export const mcpRouter = new Hono().all(
  "/",
  apiKeyAuth,
  rateLimit({ max: 120, scope: "mcp", windowSec: 60 }),
  async (c) => {
    const userId = c.get("userId");
    return mcpHandler.fetch(c.req.raw, {
      authInfo: { clientId: userId, scopes: ["mcp"], token: "" },
    });
  },
);

export { buildMcpServer, mcpHandler } from "./server";
export { resolveUserId } from "./shared";
