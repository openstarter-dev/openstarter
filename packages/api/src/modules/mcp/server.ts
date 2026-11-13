import {
  createMcpHandler,
  type McpHttpHandler,
  McpServer,
  type McpRequestContext,
} from "@modelcontextprotocol/server";

import { registerChatTools } from "./tools/chats";
import { registerCommerceTools } from "./tools/orders";
import { registerProfileTools } from "./tools/profile";
import { registerTicketTools } from "./tools/tickets";

const SERVER_INFO = { name: "openstarter-mcp-server", version: "1.0.0" } as const;

export function buildMcpServer(ctx: McpRequestContext): McpServer {
  const server = new McpServer(SERVER_INFO);

  registerProfileTools(server);
  registerCommerceTools(server);
  registerChatTools(server);
  registerTicketTools(server);

  void ctx;

  return server;
}

export const mcpHandler: McpHttpHandler = createMcpHandler(buildMcpServer);
