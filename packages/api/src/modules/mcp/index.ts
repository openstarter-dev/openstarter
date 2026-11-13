import { Hono } from "hono";

import { apiKeyAuth } from "../../middleware/auth";
import { mcpHandler } from "./server";

export const mcpRouter = new Hono().all("/", apiKeyAuth, async (c) => {
  const userId = c.get("userId");
  return mcpHandler.fetch(c.req.raw, {
    authInfo: { clientId: userId, scopes: ["mcp"], token: "" },
  });
});

export { buildMcpServer, mcpHandler } from "./server";
export { resolveUserId } from "./shared";
