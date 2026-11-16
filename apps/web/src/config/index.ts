// Web application global configuration resolved from Web environment variables.
// Web 应用全局配置管理模块，统一从 Web 端环境变量读取并校验配置。

import { BRAND_NAME } from "@/lib/branding";
import type { AnalyticsConfig } from "@openstarter/analytics-web";
import type { HeadScript } from "@openstarter/analytics-web/scripts";
import { DEFAULT_APP_URL } from "@openstarter/shared/constants";

declare global {
  interface ImportMetaEnv {
    readonly VITE_APP_NAME?: string;
    readonly VITE_APP_URL?: string;
    readonly VITE_EMAIL_AUTH_ENABLED?: string;
    readonly VITE_GOOGLE_AUTH_ENABLED?: string;
    readonly VITE_GITHUB_AUTH_ENABLED?: string;
    readonly VITE_APPLE_AUTH_ENABLED?: string;
    readonly VITE_MAGIC_LINK_ENABLED?: string;
    readonly VITE_EMAIL_OTP_ENABLED?: string;
    readonly VITE_PASSWORD_RESET_ENABLED?: string;
    readonly VITE_EMAIL_VERIFICATION_ENABLED?: string;
    readonly VITE_EMAIL_VERIFICATION_REQUIRED?: string;
    readonly VITE_INVITE_CODE_REQUIRED?: string;
    readonly VITE_ANONYMOUS_AUTH_ENABLED?: string;
    readonly VITE_GOOGLE_ONE_TAP_ENABLED?: string;
    readonly VITE_GOOGLE_CLIENT_ID?: string;
    readonly VITE_GA_MEASUREMENT_ID?: string;
    readonly VITE_PLAUSIBLE_DOMAIN?: string;
    readonly VITE_PLAUSIBLE_SRC?: string;
    readonly VITE_CRISP_ENABLED?: string;
    readonly VITE_CRISP_WEBSITE_ID?: string;
    readonly VITE_TAWK_ENABLED?: string;
    readonly VITE_TAWK_PROPERTY_ID?: string;
    readonly VITE_TAWK_WIDGET_ID?: string;
  }
}

export interface WebAuthConfig {
  emailEnabled: boolean;
  googleEnabled: boolean;
  githubEnabled: boolean;
  appleEnabled: boolean;
  magicLinkEnabled: boolean;
  emailOtpEnabled: boolean;
  passwordResetEnabled: boolean;
  emailVerificationEnabled: boolean;
  inviteCodeRequired: boolean;
  anonymousEnabled: boolean;
  googleOneTapEnabled: boolean;
  googleClientId: string;
}

export interface WebCrispConfig {
  enabled: boolean;
  websiteId: string;
}

export interface WebTawkConfig {
  enabled: boolean;
  propertyId: string;
  widgetId: string;
}

export interface WebSupportConfig {
  crisp: WebCrispConfig;
  tawk: WebTawkConfig;
}

export interface WebHeadConfig {
  analytics: AnalyticsConfig;
  support: WebSupportConfig;
}

export interface WebConfig {
  appName: string;
  appUrl: string;
  auth: WebAuthConfig;
  analytics: AnalyticsConfig;
  support: WebSupportConfig;
}

// Prefer runtime env (workerd populates process.env with vars/secrets under
// nodejs_compat; Node/Vitest work natively), then the Vite statically replaced value.
function readRuntimeOverride(key: string): string | undefined {
  if (typeof process !== "undefined" && typeof process.env === "object") {
    const procValue = process.env[key];
    if (typeof procValue === "string") {
      return procValue;
    }
  }

  return undefined;
}

// Strictly allow safe widget identifiers so inline head script interpolation cannot break quotes/tags.
// 严格白名单校验客服组件 ID，防止内联脚本插值导致 XSS 注入。
const WIDGET_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_TAWK_WIDGET_ID = "default";

interface SupportWidgetProvider {
  readonly isConfigured: (support: WebSupportConfig) => boolean;
  readonly headScripts: (support: WebSupportConfig) => HeadScript[];
}

function resolveEnv(runtimeKey: string, viteValue: string | undefined, fallback = ""): string {
  // Prefer runtime Worker/Node/Vitest env when available, then Vite statically replaced value.
  // 优先读取运行时环境变量（Worker/Node/Vitest），否则回退到 Vite 编译期静态注入值。
  const raw = readRuntimeOverride(runtimeKey) ?? viteValue;
  if (typeof raw !== "string") {
    return fallback;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? fallback : trimmed;
}

function parseBooleanFlag(value: string, defaultValue: boolean): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return defaultValue;
}

function isWidgetEnabled(flagValue: string, hasRequiredIds: boolean): boolean {
  if (!hasRequiredIds) {
    return false;
  }
  return flagValue !== "false";
}

export function isValidSupportWidgetId(id: string): boolean {
  return WIDGET_ID_PATTERN.test(id);
}

// Registry pattern matching @openstarter/analytics-web/scripts to add/toggle widgets cleanly.
// 使用策略注册表管理客服脚本供应商，保持低圈复杂度并易于扩展。
const SUPPORT_WIDGET_PROVIDERS: readonly SupportWidgetProvider[] = [
  {
    isConfigured: (support) =>
      support.crisp.enabled && isValidSupportWidgetId(support.crisp.websiteId),
    headScripts: (support) => [
      {
        id: "crisp-init",
        children: `window.$crisp=[];window.CRISP_WEBSITE_ID='${support.crisp.websiteId}';`,
      },
      {
        id: "crisp-loader",
        async: true,
        src: "https://client.crisp.chat/l.js",
      },
    ],
  },
  {
    isConfigured: (support) =>
      support.tawk.enabled &&
      isValidSupportWidgetId(support.tawk.propertyId) &&
      isValidSupportWidgetId(support.tawk.widgetId),
    headScripts: (support) => [
      {
        id: "tawk-init",
        children: "var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();",
      },
      {
        id: "tawk-loader",
        async: true,
        src: `https://embed.tawk.to/${support.tawk.propertyId}/${support.tawk.widgetId}`,
      },
    ],
  },
];

/**
 * Resolve Crisp and Tawk head scripts for TanStack Router `head().scripts`.
 * 构造 Crisp 与 Tawk 客服组件注入脚本描述，供根路由 `head().scripts` 使用。
 */
export function buildSupportHeadScripts(support: WebSupportConfig | undefined): HeadScript[] {
  if (!support) {
    return [];
  }
  return SUPPORT_WIDGET_PROVIDERS.filter((provider) => provider.isConfigured(support)).flatMap(
    (provider) => provider.headScripts(support),
  );
}

/**
 * Read Web global configuration from static Vite env and SSR/Worker runtime env.
 * 读取 Web 端全局配置（认证展示开关、分析统计、客服组件及基础品牌信息）。
 */
export function getWebConfig(): WebConfig {
  const emailVerificationRaw =
    resolveEnv(
      "VITE_EMAIL_VERIFICATION_ENABLED",
      import.meta.env.VITE_EMAIL_VERIFICATION_ENABLED,
    ) ||
    resolveEnv(
      "VITE_EMAIL_VERIFICATION_REQUIRED",
      import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED,
    );

  const crispWebsiteId = resolveEnv("VITE_CRISP_WEBSITE_ID", import.meta.env.VITE_CRISP_WEBSITE_ID);
  const crispFlag = resolveEnv("VITE_CRISP_ENABLED", import.meta.env.VITE_CRISP_ENABLED);

  const tawkPropertyId = resolveEnv("VITE_TAWK_PROPERTY_ID", import.meta.env.VITE_TAWK_PROPERTY_ID);
  const tawkWidgetId = resolveEnv(
    "VITE_TAWK_WIDGET_ID",
    import.meta.env.VITE_TAWK_WIDGET_ID,
    DEFAULT_TAWK_WIDGET_ID,
  );
  const tawkFlag = resolveEnv("VITE_TAWK_ENABLED", import.meta.env.VITE_TAWK_ENABLED);

  return {
    appName: resolveEnv("VITE_APP_NAME", import.meta.env.VITE_APP_NAME, BRAND_NAME),
    appUrl: resolveEnv("VITE_APP_URL", import.meta.env.VITE_APP_URL, DEFAULT_APP_URL),
    auth: {
      emailEnabled: parseBooleanFlag(
        resolveEnv("VITE_EMAIL_AUTH_ENABLED", import.meta.env.VITE_EMAIL_AUTH_ENABLED),
        true,
      ),
      googleEnabled: parseBooleanFlag(
        resolveEnv("VITE_GOOGLE_AUTH_ENABLED", import.meta.env.VITE_GOOGLE_AUTH_ENABLED),
        false,
      ),
      githubEnabled: parseBooleanFlag(
        resolveEnv("VITE_GITHUB_AUTH_ENABLED", import.meta.env.VITE_GITHUB_AUTH_ENABLED),
        false,
      ),
      appleEnabled: parseBooleanFlag(
        resolveEnv("VITE_APPLE_AUTH_ENABLED", import.meta.env.VITE_APPLE_AUTH_ENABLED),
        false,
      ),
      magicLinkEnabled: parseBooleanFlag(
        resolveEnv("VITE_MAGIC_LINK_ENABLED", import.meta.env.VITE_MAGIC_LINK_ENABLED),
        false,
      ),
      emailOtpEnabled: parseBooleanFlag(
        resolveEnv("VITE_EMAIL_OTP_ENABLED", import.meta.env.VITE_EMAIL_OTP_ENABLED),
        false,
      ),
      passwordResetEnabled: parseBooleanFlag(
        resolveEnv("VITE_PASSWORD_RESET_ENABLED", import.meta.env.VITE_PASSWORD_RESET_ENABLED),
        false,
      ),
      emailVerificationEnabled: parseBooleanFlag(emailVerificationRaw, false),
      inviteCodeRequired: parseBooleanFlag(
        resolveEnv("VITE_INVITE_CODE_REQUIRED", import.meta.env.VITE_INVITE_CODE_REQUIRED),
        false,
      ),
      anonymousEnabled: parseBooleanFlag(
        resolveEnv("VITE_ANONYMOUS_AUTH_ENABLED", import.meta.env.VITE_ANONYMOUS_AUTH_ENABLED),
        false,
      ),
      googleOneTapEnabled: parseBooleanFlag(
        resolveEnv("VITE_GOOGLE_ONE_TAP_ENABLED", import.meta.env.VITE_GOOGLE_ONE_TAP_ENABLED),
        false,
      ),
      googleClientId: resolveEnv("VITE_GOOGLE_CLIENT_ID", import.meta.env.VITE_GOOGLE_CLIENT_ID),
    },
    analytics: {
      googleAnalyticsId: resolveEnv(
        "VITE_GA_MEASUREMENT_ID",
        import.meta.env.VITE_GA_MEASUREMENT_ID,
      ),
      plausibleDomain: resolveEnv("VITE_PLAUSIBLE_DOMAIN", import.meta.env.VITE_PLAUSIBLE_DOMAIN),
      plausibleSrc: resolveEnv("VITE_PLAUSIBLE_SRC", import.meta.env.VITE_PLAUSIBLE_SRC),
    },
    support: {
      crisp: {
        enabled: isWidgetEnabled(crispFlag, crispWebsiteId !== ""),
        websiteId: crispWebsiteId,
      },
      tawk: {
        enabled: isWidgetEnabled(tawkFlag, tawkPropertyId !== "" && tawkWidgetId !== ""),
        propertyId: tawkPropertyId,
        widgetId: tawkWidgetId,
      },
    },
  };
}
