// apps/mobile/src/lib/api.ts —— 类型化 Hono RPC 客户端。
//
// 与 apps/web 的 `hc<AppType>("/")` 完全对称，差异只有两点：
//   - 绝对 base URL（移动端不在 Web 同源下，没有相对路径可用）；
//   - 显式 cookie 头（原生端没有浏览器自动带 cookie 的行为）。
//
// AppType 是 **type-only** 导入：@openstarter/api 在 devDependencies 里，
// 该导入在编译期被擦除，Metro 不会看到服务端依赖图（tsconfig 的
// verbatimModuleSyntax 会在编译期挡住误写成值导入的情况）。见 spec §3.2 / §5.2。
import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

import { getSessionCookie } from "./auth-client";
import { getEnv } from "./env";

const env = getEnv();

export const apiClient = hc<AppType>(env.ok ? env.apiUrl : "http://127.0.0.1", {
  headers: () => ({ cookie: getSessionCookie() }),
});
