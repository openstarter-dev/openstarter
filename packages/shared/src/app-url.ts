// packages/shared/src/app-url.ts —— 全仓库唯一的「应用对外地址（origin）」解析器。
//
// 同一个 origin 历史上由三个变量分别表达（VITE_APP_URL / BETTER_AUTH_URL / URL），
// 各端各自维护回落链，极易漂移。收口到这里后，以下消费方共用同一优先级：
//   · better-auth 的 baseURL（packages/auth/src/server.ts —— 决定回调/跳转与 origin 校验）；
//   · SSR 的 canonical / og:url（apps/web/src/lib/page-head.ts）；
//   · 邮件 / 邀请链接在无请求上下文时的兜底（packages/auth/src/lib/utils.ts）；
//   · extension / mobile / mini-app 构建期派生各自的 API base。
//
// 命名取舍：主名用 VITE_APP_URL —— 扩展客户端运行时读 import.meta.env.VITE_APP_URL，
// 生产 wrangler vars 与 shared config（app_url / auth_url）也以此为准；
// BETTER_AUTH_URL 按 better-auth 官方文档保留为兼容 alias，排在主名之后。
//
// 注意：VITE_ 变量会被 Vite 在构建期内联进客户端产物，故本模块只应在服务端 /
// 构建期取「配置的站点地址」；浏览器端要「当前 origin」请用 window.location.origin。

/** 本地开发的最终兜底，与 apps/web/vite.config.ts 的 server.port 保持一致。 */
export const DEFAULT_APP_URL = "http://localhost:3000";

/** 运行时 env 读取：浏览器/Worker 无 process 时返回空对象，避免 ReferenceError。 */
function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}

/**
 * 读取「显式配置」的应用地址：按 `VITE_APP_URL` → `APP_URL` → `BETTER_AUTH_URL` →
 * `URL`（legacy）依次尝试，均未配置时返回 `undefined`。
 *
 * 与 {@link resolveAppUrl} 的区别：不注入 localhost 兜底，供「缺失时另有兜底」
 * 的调用方（如浏览器端回退 window.location.origin）判断用。
 */
export function readConfiguredAppUrl(
  env: Record<string, string | undefined> = readProcessEnv(),
): string | undefined {
  for (const value of [env.VITE_APP_URL, env.APP_URL, env.BETTER_AUTH_URL, env.URL]) {
    const trimmed = value?.trim();
    if (trimmed) {
      // 末尾斜杠会让拼接出 `//api/auth` 这类路径，统一去掉。
      return trimmed.replace(/\/+$/, "");
    }
  }
  return undefined;
}

/**
 * 解析应用对外地址（含协议，末尾无斜杠）。
 *
 * 优先级：`VITE_APP_URL` → `APP_URL` → `BETTER_AUTH_URL` → `URL`（legacy）→ 本地默认。
 * 空白值视为未设置。
 */
export function resolveAppUrl(env: Record<string, string | undefined> = readProcessEnv()): string {
  return readConfiguredAppUrl(env) ?? DEFAULT_APP_URL;
}
