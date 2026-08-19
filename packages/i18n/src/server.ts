// @openstarter/i18n/server —— 服务端 locale 解析入口。
// 依「显式 URL 前缀 / locale cookie / Accept-Language / 默认语言」的顺序解析请求语言；
// request 可空（缺省或无匹配时回落默认语言）。供 Auth_Service 传给邮件渲染按语言取文案。
// 位于 auth 依赖层之下，不依赖 packages/api、packages/auth（仅复用包根的受支持语言集合）。
// Requirements: 23.4、23.6。

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./index";
import type { SupportedLocale } from "./index";

// Paraglide 客户端切换语言时写入的 locale cookie 名。
const LOCALE_COOKIE_NAME = "PARAGLIDE_LOCALE";

// 精确匹配受支持的 locale；命中则返回收敛后的字面量类型，否则返回 null。
function toSupportedLocale(value: string): SupportedLocale | null {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === value) {
      return locale;
    }
  }
  return null;
}

// 将任意语言标签收敛为受支持的 locale（大小写无关，兼容 en-US 之类的区域标签）。
function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) {
    return null;
  }
  const lower = value.trim().toLowerCase();
  const exact = toSupportedLocale(lower);
  if (exact) {
    return exact;
  }
  const [base] = lower.split("-");
  if (base) {
    return toSupportedLocale(base);
  }
  return null;
}

// cookie 值可能被 URL 编码；解码失败时回退原始值，避免抛出。
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// 解析 Accept-Language 单项的 q 权重：缺省为 1，非法值视为 0（不参与选取）。
function parseQuality(params: string[]): number {
  for (const param of params) {
    const [key, value] = param.trim().split("=");
    if (key?.trim() === "q") {
      const quality = Number.parseFloat(value ?? "");
      if (Number.isNaN(quality)) {
        return 0;
      }
      return quality;
    }
  }
  return 1;
}

// 从完整 URL 中提取 pathname；非法 URL 返回 null。
function parsePathname(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

// 显式来源：路径首段的 locale 前缀（如 /zh/...）。
function getLocaleFromUrl(url: string): SupportedLocale | null {
  const pathname = parsePathname(url);
  if (!pathname) {
    return null;
  }
  const [segment] = pathname.split("/").filter(Boolean);
  return normalizeLocale(segment);
}

// 用户偏好来源：Paraglide 写入的 locale cookie。
function getLocaleFromCookie(cookieHeader: string | null): SupportedLocale | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.split("=");
    if (rawName?.trim() !== LOCALE_COOKIE_NAME) {
      continue;
    }
    return normalizeLocale(safeDecode(rawValue.join("=").trim()));
  }
  return null;
}

// 内容协商来源：Accept-Language，按 q 权重取受支持语言中权重最高者（并列取先出现者）。
function getLocaleFromAcceptLanguage(header: string | null): SupportedLocale | null {
  if (!header) {
    return null;
  }
  let best: SupportedLocale | null = null;
  let bestQuality = 0;
  for (const part of header.split(",")) {
    const [rawTag, ...params] = part.trim().split(";");
    const quality = parseQuality(params);
    if (quality <= 0) {
      continue;
    }
    const locale = normalizeLocale(rawTag);
    if (locale && quality > bestQuality) {
      best = locale;
      bestQuality = quality;
    }
  }
  return best;
}

// 默认语言：优先 VITE_DEFAULT_LOCALE（服务端由 process.env 提供），否则回落 DEFAULT_LOCALE（en）。
function resolveDefaultLocale(): string {
  const configured = process.env.VITE_DEFAULT_LOCALE?.trim();
  if (configured) {
    return configured;
  }
  return DEFAULT_LOCALE;
}

/**
 * 依请求解析展示 locale。
 *
 * 解析优先级：显式 URL 前缀 / locale cookie → Accept-Language → 默认语言。
 * `request` 缺省或均无匹配时返回默认语言（`VITE_DEFAULT_LOCALE` 或 `en`）。
 *
 * @param request 传入请求；可空以兼容无请求上下文的调用。
 * @returns 解析出的 locale 字符串。
 */
export function getLocaleFromRequest(request?: Request): string {
  const fallback = resolveDefaultLocale();
  if (!request) {
    return fallback;
  }

  const fromUrl = getLocaleFromUrl(request.url);
  if (fromUrl) {
    return fromUrl;
  }

  const fromCookie = getLocaleFromCookie(request.headers.get("cookie"));
  if (fromCookie) {
    return fromCookie;
  }

  const fromHeader = getLocaleFromAcceptLanguage(request.headers.get("accept-language"));
  if (fromHeader) {
    return fromHeader;
  }

  return fallback;
}
