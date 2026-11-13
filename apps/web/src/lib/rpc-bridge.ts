/**
 * SSR 阶段 RPC 的进程内桥接位（无任何 import，可安全进入客户端 bundle）。
 *
 * 浏览器侧 `hc` 用相对 base（`/`）走同源请求即可；但服务端（Node / Workers）的
 * `fetch` 拒绝相对 URL（`TypeError: Failed to parse URL from /api/...`），而路由
 * loader 的 `prefetchQuery` 同样会在 SSR 阶段跑一遍 queryFn——没有桥接时这些预取
 * 会静默失败（`preloadQueries` 用 `allSettled` 兜住异常），首屏只剩骨架。
 *
 * `src/server.ts`（请求入口）负责装入桥接；`lib/api.ts` 在每次调用时读取，
 * 因此不依赖模块求值顺序（server.ts 的 import 链会先加载 lib/api.ts）。
 */
export type RpcFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let bridge: RpcFetch | undefined;

/** 仅服务端入口调用；传 `undefined` 可复位（测试用），浏览器侧保持 undefined。 */
export function setRpcFetchBridge(next: RpcFetch | undefined): void {
  bridge = next;
}

export function getRpcFetchBridge(): RpcFetch | undefined {
  return bridge;
}
