// @openstarter/shared/constants 子路径入口。
// 提供跨能力域共享的运行时常量，并满足 Auth_Service 现有引用：
//   - packages/auth/src/env.ts    引用 envConfig、NodeEnv
//   - packages/auth/src/server.ts 引用 NodeEnv
// 说明：这里不 import envin（保持 shared 位于依赖图底层、可独立类型检查）；
// envConfig 仅为一个可被各包 env.ts 展开进 envin `defineEnv` 的基线预设对象。

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

/**
 * envin 基线预设：被各包（如 auth/env.ts）以 `...envConfig` 展开进 `defineEnv`。
 * 仅提供跨包一致的基线字段（client 变量前缀与空的 schema 槽位），
 * 具体的 server / client / shared 变量由各包在自身 env.ts 中声明后合并覆盖。
 * 运行时 env 源交由 envin 默认解析（无需在此固定 process.env / import.meta.env）。
 */
export const envConfig = {
  // TanStack Start / Vite 下客户端变量前缀。
  clientPrefix: "VITE_",
  client: {},
  server: {},
  shared: {},
} as const;
