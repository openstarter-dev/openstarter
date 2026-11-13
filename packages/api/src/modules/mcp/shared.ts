import type { AuthInfo, BaseContext } from "@modelcontextprotocol/server";

export function resolveUserId(extra: BaseContext): string {
  const clientId = (extra.http?.authInfo as AuthInfo | undefined)?.clientId;
  if (!clientId) {
    throw new Error("MCP request context is missing an authenticated user");
  }
  return clientId;
}

export function jsonContent(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

export function toolError(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return { isError: true, content: [{ type: "text", text: message }] };
}

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

export function toIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
