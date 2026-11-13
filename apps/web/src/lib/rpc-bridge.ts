export type RpcFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let bridge: RpcFetch | undefined;

export function setRpcFetchBridge(next: RpcFetch | undefined): void {
  bridge = next;
}

export function getRpcFetchBridge(): RpcFetch | undefined {
  return bridge;
}
