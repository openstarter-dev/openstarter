import { hcWithType } from "@openstarter/api/client";
import type {} from "@tanstack/query-core";

import { getRpcFetchBridge, type RpcFetch } from "@/lib/rpc-bridge";

const rpcFetch: RpcFetch = (input, init) => {
  const bridge = getRpcFetchBridge();
  return bridge ? bridge(input, init) : fetch(input, init);
};

export const client = hcWithType("/", { fetch: rpcFetch });

export type InvalidatesMeta =
  | readonly (readonly unknown[])[]
  | ((variables: never) => readonly (readonly unknown[])[]);

declare module "@tanstack/query-core" {
  interface Register {
    mutationMeta: { invalidates?: InvalidatesMeta };
  }
}

export const withAbort = (signal: AbortSignal) => ({ init: { signal } }) as const;

type Body = { data?: unknown; message?: string };

async function readBody(res: { json: () => Promise<unknown> }): Promise<Body | null> {
  return (await res.json().catch(() => null)) as Body | null;
}

export async function unwrapMutation<TData>(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<TData> {
  const json = (await readBody(res)) as { data?: TData; message?: string } | null;
  if (!res.ok) {
    throw new Error(json?.message || fallbackMessage);
  }
  if (json?.data === undefined || json?.data === null) {
    throw new Error(fallbackMessage);
  }
  return json.data;
}

export async function assertOk(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<void> {
  if (res.ok) {
    return;
  }
  const json = await readBody(res);
  throw new Error(json?.message || fallbackMessage);
}

export async function unwrapQuery<TData>(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<TData | undefined> {
  const json = await readBody(res);
  if (!res.ok) {
    throw new Error(json?.message || fallbackMessage);
  }
  return json?.data as TData | undefined;
}
