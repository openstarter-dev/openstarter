// packages/auth/src/lib/utils —— 认证 URL 组装工具（@openstarter/auth 的 `./lib/utils`）。
//
// 现有 `server.ts` 在验证 / 重置 / 改邮箱 / 删账号 / magic link / OTP / 组织邀请等
// 流程中调用 `getUrl(...)` 组装可直接访问的验证 / 回调 URL；`index.ts` 亦 re-export 之。
//
// 语义：better-auth 已生成含签名令牌及最终 callbackURL 的可执行 URL，因此给定
// `url` / `type` 时直接返回该 URL；未给定时返回应用基址（调用方可继续追加 query，
// 如组织邀请的 invitationId）。这避免把邮件指向应用中不存在的包装路由。

import { DEFAULT_APP_URL } from "@openstarter/shared/constants";

import type { VerificationType } from "../types";

/**
 * `getUrl` 的入参。
 * - `request`：传入请求（可空，兼容无请求上下文的调用，如部分 OTP 场景）。
 * - `url`：better-auth 生成的原始回调链接（含令牌）。
 * - `type`：验证类型，决定前端接管路由。
 */
export interface GetUrlParams {
  request?: Request;
  type?: VerificationType;
  url?: string;
}

// 安全解析来源：非法 URL 返回 null 而非抛出。
const parseOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * 解析应用基址（origin）。
 *
 * 优先取请求的 `origin` 头，其次取请求 URL 的 origin；均不可得时回落到
 * `VITE_APP_URL`（唯一事实源：apps/web/.env），再缺失则用本地默认。
 */
export const getBaseUrl = (request?: Request): string => {
  if (request) {
    const origin = request.headers.get("origin");
    if (origin) {
      return origin;
    }
    const fromRequestUrl = parseOrigin(request.url);
    if (fromRequestUrl) {
      return fromRequestUrl;
    }
  }
  return (process.env.VITE_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
};

/**
 * 解析应用基址（origin），不依赖请求上下文。
 *
 * 与 `getBaseUrl` 的差别：不读请求头，供 better-auth 的 `baseURL` 与部署面开关
 * （https 判定、本机来源判定）使用；唯一事实源仍是 `VITE_APP_URL`。
 */
export const getAppUrl = (): string =>
  // 空串按缺失处理：`??` 不拦空串，而 baseURL 为空会让 better-auth 回退到
  // 「按请求自身推导来源」，等于放开 CSRF 原点校验。
  (process.env.VITE_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");

/**
 * 判断应用基址是否指向本机。
 *
 * 只认 `localhost` / `127.0.0.1` / `[::1]`，**不依据 `NODE_ENV`**：auth env 预设把缺省的
 * `NODE_ENV` 兜底成 `"development"`，Worker 上会恒为真，生产也会放开 localhost 来源。
 */
export const isLoopbackAppUrl = (appUrl: string): boolean =>
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(appUrl);

/**
 * 组装验证 / 回调 URL。
 *
 * 给定 `url` 与 `type` 时，返回 better-auth 生成的原始可执行回调 URL；否则返回
 * 应用基址。`type` 保留为调用方的验证意图约束，防止无类型 URL 被误当作验证链接。
 */
export const getUrl = ({ request, url, type }: GetUrlParams): URL => {
  if (url && type) {
    return new URL(url);
  }
  return new URL(getBaseUrl(request));
};
