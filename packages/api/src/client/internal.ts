import { hc } from "hono/client";

import type { AppType } from "../index";

export type InternalRpcClient = ReturnType<typeof hc<AppType>>;

export async function createInternalRpc(baseUrl: string): Promise<InternalRpcClient> {
  const { app } = await import("../index");
  return hc<AppType>(baseUrl, {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const Ctor = Request as unknown as new (
        input: string | Request,
        init?: RequestInit,
      ) => Request;
      const resolved = input instanceof URL ? input.href : input;
      return Promise.resolve(app.fetch(new Ctor(resolved, init)));
    },
  });
}
