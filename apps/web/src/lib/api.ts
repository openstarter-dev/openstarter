import { createApiClient } from "@openstarter/api/client";

import { getRpcFetchBridge, type RpcFetch } from "@/lib/rpc-bridge";

const rpcFetch: RpcFetch = (input, init) => {
  const bridge = getRpcFetchBridge();
  return bridge ? bridge(input, init) : fetch(input, init);
};

export const client = createApiClient({ baseUrl: "/", fetch: rpcFetch });

export { assertOk, unwrapMutation, unwrapQuery, withAbort } from "@openstarter/api/client";
