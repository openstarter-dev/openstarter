// Shared plumbing for MCP tool registration.
//
// Every tool handler resolves the acting user from the request context
// (`authInfo.clientId`, injected by the router after API-key validation) —
// never from tool arguments. This module owns the context plumbing, the
// JSON result envelope, and the error formatting so individual tools stay
// focused on their domain call. Tool input schemas live in schema/mcp.

import type { AuthInfo, BaseContext } from "@modelcontextprotocol/server";

/**
 * Extract the authenticated user id from the tool-call extra.
 *
 * The router validates the API key and passes the resolved userId as
 * `authInfo.clientId` (see `router.ts`); a missing value means the handler
 * was mounted without the auth middleware — fail closed.
 */
export function resolveUserId(extra: BaseContext): string {
  const clientId = (extra.http?.authInfo as AuthInfo | undefined)?.clientId;
  if (!clientId) {
    throw new Error("MCP request context is missing an authenticated user");
  }
  return clientId;
}

/** JSON-serialize a payload as the tool's single text content block. */
export function jsonContent(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

/**
 * Build an `isError` tool result with an actionable message.
 *
 * Messages address the model that will read them: state what failed and name
 * the tool that would recover. Internal details (stacks, SQL) never leak.
 */
export function toolError(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * Run a tool callback, converting thrown errors into `isError` results.
 * Known domain errors surface their message; everything else becomes a
 * generic failure notice (details are logged by the API error handler).
 */
export async function withToolError(
  action: () => Promise<{ content: Array<{ type: "text"; text: string }> }>,
): Promise<{ isError?: boolean; content: Array<{ type: "text"; text: string }> }> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Error) {
      return toolError(error.message);
    }
    return toolError("Unexpected failure while processing the request");
  }
}

/** Convert DB timestamps to ISO strings so JSON.stringify stays stable. */
export function toIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
