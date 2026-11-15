// @openstarter/shared/constants 子路径入口。
// 提供跨能力域共享的运行时常量，并满足 Auth_Service 现有引用：
//   - packages/auth/src/env.ts    引用 NodeEnv
//   - packages/auth/src/server.ts 引用 NodeEnv

/**
 * 本地开发的应用对外地址兜底，与 `apps/web/vite.config.ts` 的 `server.port` 保持一致。
 *
 * 唯一事实源是 `apps/web/.env` 的 `VITE_APP_URL`，各消费方直接读该环境变量；
 * 这里只提供缺省值，避免各处重复硬编码 localhost:3000。
 */
export const DEFAULT_APP_URL = "http://localhost:3000";

/**
 * Node 运行环境取值。以 `as const` 对象 + 同名联合类型表达（遵循 ultracite：不使用 enum）。
 * 既作为值使用（`NodeEnv.DEVELOPMENT`），也作为类型使用（`NodeEnv`）。
 */
export const NodeEnv = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv];
