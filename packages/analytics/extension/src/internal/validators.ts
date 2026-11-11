// @openstarter/analytics-extension/internal —— 配置校验（包内模块，仅 providers/* 与 config 引用）。
//
// 这些值不会像 analytics-web 那样被插值进可执行脚本（扩展端只走 JSON 请求体），
// 因此校验目的不是 XSS 防护，而是「别把注定被供应商丢弃的事件发出去」：
//   - 域名用于供应商侧的域名归属匹配，格式错误一律视为未配置；
//   - siteUrl 必须是 http(s) 绝对 URL（Plausible 按 url 归属校验）。

const PLAUSIBLE_DOMAIN_PATTERN = /^[A-Za-z0-9.,_-]+$/;
const MAX_DOMAIN_LENGTH = 253;
const SITE_PROTOCOLS = new Set(["http:", "https:"]);

/** 校验 Plausible 域名：非空、长度受限、仅含允许字符集（支持逗号分隔多域）。 */
export function isValidPlausibleDomain(domain: string): boolean {
  return (
    domain.length > 0 &&
    domain.length <= MAX_DOMAIN_LENGTH &&
    PLAUSIBLE_DOMAIN_PATTERN.test(domain)
  );
}

/** 校验站点 URL：必须为 http(s) 绝对 URL。 */
export function isValidSiteUrl(url: string): boolean {
  try {
    return SITE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** 归一 host：去尾部斜杠，非法 URL 回退到给定的默认值。 */
export function resolveHost(host: string, fallback: string): string {
  const trimmed = host.trim().replace(/\/+$/u, "");
  if (trimmed === "") {
    return fallback;
  }
  try {
    const url = new URL(trimmed);
    return SITE_PROTOCOLS.has(url.protocol) ? trimmed : fallback;
  } catch {
    return fallback;
  }
}
