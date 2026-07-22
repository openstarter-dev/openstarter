// @openstarter/shared/config —— Config_Service（R2）。
//
// 运行时配置双源合并：环境变量（预定义默认，兜底）+ `config` 表（DB 覆盖）。
// - getAllConfigs：读取合并结果（env/默认兜底、DB 覆盖、秘密解密、1h 内存缓存）。R2.1/R2.3
// - saveConfigs：写入（upsert）——保护键丢弃、掩码值跳过、秘密加密、校验后落库。R2.2/R2.5
// - getAdminConfigs：面向后台的安全视图（保护键移除、秘密值掩码，绝不把 getAllConfigs 直接下发前端）。
// - getSettings/getSettingGroups/getSettingTabs：分组元数据，供 Admin_Console 分类渲染。R2.4
//
// 数据层：读写 `@openstarter/db/schema` 的 `config` 表；连接用 `@openstarter/db/server` 的
// `db()` 单例访问器（稳定契约）。经惰性 dynamic import 获取，把连接与其 env 解析延迟到首次
// DB 访问，配合下方 database_url 守卫与 try/catch，使无 DB 配置或 DB 不可用时读取优雅降级为
// 「仅 env/默认」，不阻断整体读取。
//
// 秘密加解密：复用本包 `./crypto`（同步；加密密钥缺失时抛错，见任务 3.1）。因此解密时用
// 同步调用 + try/catch：解密失败跳过该项、回退 env 值并告警，不阻断其余配置读取。

import type { Database } from "@openstarter/db";
import { config } from "@openstarter/db/schema";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./crypto";
import { logger } from "./logger";

// ─── 类型（Types）──────────────────────────────────────────────────────────

/** 配置键值对集合。 */
export type ConfigMap = Record<string, string>;

/** 单个配置项定义（驱动后台设置界面与写入校验）。 */
export interface Setting {
  name: string;
  title: string;
  type: "text" | "password" | "textarea" | "number" | "switch" | "select";
  placeholder?: string;
  options?: { label: string; value: string }[];
  tip?: string;
  group: string;
  tab: string;
  defaultValue?: string;
}

/** 配置分组（归属某个 tab）。 */
export interface SettingGroup {
  name: string;
  title: string;
  description?: string;
  tab: string;
}

/** 配置分页（Admin_Console 顶层分类）。 */
export interface SettingTab {
  name: string;
  title: string;
}

// ─── 分组元数据（R2.4）──────────────────────────────────────────────────────

/** 顶层分页：auth / payment / email / storage / ai / analytics 等。 */
export function getSettingTabs(): SettingTab[] {
  return [
    { name: "general", title: "General" },
    { name: "auth", title: "Auth" },
    { name: "payment", title: "Payment" },
    { name: "email", title: "Email" },
    { name: "storage", title: "Storage" },
    { name: "ai", title: "AI" },
    { name: "analytics", title: "Analytics" },
    { name: "customer_service", title: "Customer Service" },
  ];
}

/** 分组：每个分组归属一个 tab，含积分（credit）、认证、支付、邮件、存储、AI 等。 */
export function getSettingGroups(): SettingGroup[] {
  return [
    {
      name: "appinfo",
      title: "App Info",
      description: "Basic application settings",
      tab: "general",
    },
    {
      name: "user_role",
      title: "User Roles",
      description: "Default role for new users",
      tab: "general",
    },
    {
      name: "credit",
      title: "Credits",
      description: "Initial credits for new users",
      tab: "general",
    },
    {
      name: "email_auth",
      title: "Email Auth",
      description: "Email/password authentication",
      tab: "auth",
    },
    {
      name: "google_auth",
      title: "Google Auth",
      description: "Google OAuth login",
      tab: "auth",
    },
    {
      name: "github_auth",
      title: "GitHub Auth",
      description: "GitHub OAuth login",
      tab: "auth",
    },
    {
      name: "basic_payment",
      title: "Basic",
      description: "Payment general settings",
      tab: "payment",
    },
    {
      name: "stripe",
      title: "Stripe",
      description: "Stripe payment gateway",
      tab: "payment",
    },
    {
      name: "paypal",
      title: "PayPal",
      description: "PayPal payment gateway",
      tab: "payment",
    },
    {
      name: "alipay",
      title: "Alipay",
      description: "Alipay payment gateway (native)",
      tab: "payment",
    },
    {
      name: "wechat",
      title: "WeChat Pay",
      description: "WeChat Pay gateway (native)",
      tab: "payment",
    },
    {
      name: "email_general",
      title: "General",
      description: "Email provider selection",
      tab: "email",
    },
    {
      name: "resend",
      title: "Resend",
      description: "Resend email service",
      tab: "email",
    },
    {
      name: "cloudflare_email",
      title: "Cloudflare Email",
      description: "Cloudflare Email Service",
      tab: "email",
    },
    {
      name: "r2",
      title: "Cloudflare R2 / S3",
      description: "Object storage settings",
      tab: "storage",
    },
    {
      name: "openai",
      title: "OpenAI",
      description: "OpenAI (or compatible) API",
      tab: "ai",
    },
    {
      name: "anthropic",
      title: "Anthropic",
      description: "Anthropic Claude API",
      tab: "ai",
    },
    {
      name: "replicate",
      title: "Replicate",
      description: "Replicate AI API",
      tab: "ai",
    },
    { name: "fal", title: "Fal", description: "Fal AI API", tab: "ai" },
    {
      name: "google_analytics",
      title: "Google Analytics",
      description: "Inject gtag.js with the configured Measurement ID",
      tab: "analytics",
    },
    {
      name: "plausible",
      title: "Plausible",
      description: "Inject plausible.js for self-hosted or cloud Plausible",
      tab: "analytics",
    },
    {
      name: "crisp",
      title: "Crisp",
      description: "Crisp live chat widget",
      tab: "customer_service",
    },
    {
      name: "tawk",
      title: "Tawk.to",
      description: "Tawk.to live chat widget",
      tab: "customer_service",
    },
  ];
}

/**
 * 全部配置项定义（含 name / type / group / tab 等元数据）。
 * 既驱动后台分类展示（R2.4），也作为写入校验（R2.5）与秘密键识别的依据。
 */
export function getSettings(): Setting[] {
  return [
    // General / App Info
    {
      name: "app_name",
      title: "App Name",
      type: "text",
      placeholder: "My App",
      group: "appinfo",
      tab: "general",
    },
    {
      name: "app_description",
      title: "App Description",
      type: "textarea",
      placeholder: "Ship your SaaS faster",
      group: "appinfo",
      tab: "general",
    },
    {
      name: "app_url",
      title: "App URL",
      type: "text",
      placeholder: "https://example.com",
      group: "appinfo",
      tab: "general",
    },

    // General / User Roles
    {
      name: "initial_role_enabled",
      title: "Auto-assign role for new users",
      type: "switch",
      group: "user_role",
      tab: "general",
    },
    {
      name: "initial_role_name",
      title: "Default role name",
      type: "text",
      placeholder: "viewer",
      group: "user_role",
      tab: "general",
    },

    // General / Credits
    {
      name: "initial_credits_enabled",
      title: "Grant credits on signup",
      type: "switch",
      group: "credit",
      tab: "general",
    },
    {
      name: "initial_credits_amount",
      title: "Credits amount",
      type: "number",
      placeholder: "100",
      group: "credit",
      tab: "general",
    },
    {
      name: "initial_credits_valid_days",
      title: "Valid days",
      type: "number",
      placeholder: "365",
      group: "credit",
      tab: "general",
    },
    {
      name: "initial_credits_description",
      title: "Description",
      type: "text",
      placeholder: "Welcome bonus",
      group: "credit",
      tab: "general",
    },

    // Auth / Email
    {
      name: "email_auth_enabled",
      title: "Enable email auth",
      type: "switch",
      group: "email_auth",
      tab: "auth",
      defaultValue: "true",
    },
    {
      name: "email_verification_enabled",
      title: "Require email verification on sign up",
      type: "switch",
      group: "email_auth",
      tab: "auth",
      defaultValue: "false",
    },
    {
      name: "invite_code_required",
      title: "Require invite code on sign up",
      type: "switch",
      group: "email_auth",
      tab: "auth",
      defaultValue: "false",
    },

    // Auth / Google
    {
      name: "google_auth_enabled",
      title: "Enable Google auth",
      type: "switch",
      group: "google_auth",
      tab: "auth",
    },
    {
      name: "google_one_tap_enabled",
      title: "Enable Google One Tap",
      type: "switch",
      group: "google_auth",
      tab: "auth",
      tip: "Show the Google One Tap prompt to signed-out visitors. Requires Client ID.",
    },
    {
      name: "google_client_id",
      title: "Client ID",
      type: "text",
      placeholder: "xxx.apps.googleusercontent.com",
      group: "google_auth",
      tab: "auth",
    },
    {
      name: "google_client_secret",
      title: "Client Secret",
      type: "password",
      placeholder: "GOCSPX-xxx",
      group: "google_auth",
      tab: "auth",
    },

    // Auth / GitHub
    {
      name: "github_auth_enabled",
      title: "Enable GitHub auth",
      type: "switch",
      group: "github_auth",
      tab: "auth",
    },
    {
      name: "github_client_id",
      title: "Client ID",
      type: "text",
      placeholder: "Ov23xxx",
      group: "github_auth",
      tab: "auth",
    },
    {
      name: "github_client_secret",
      title: "Client Secret",
      type: "password",
      placeholder: "xxx",
      group: "github_auth",
      tab: "auth",
    },

    // Payment / Basic
    {
      name: "select_payment_enabled",
      title: "Show payment method selector",
      type: "switch",
      group: "basic_payment",
      tab: "payment",
    },
    {
      name: "default_payment_provider",
      title: "Default provider",
      type: "select",
      options: [
        { label: "Stripe", value: "stripe" },
        { label: "PayPal", value: "paypal" },
        { label: "Alipay", value: "alipay" },
        { label: "WeChat Pay", value: "wechat" },
      ],
      group: "basic_payment",
      tab: "payment",
    },

    // Payment / Stripe
    {
      name: "stripe_enabled",
      title: "Enable Stripe",
      type: "switch",
      group: "stripe",
      tab: "payment",
    },
    {
      name: "stripe_publishable_key",
      title: "Publishable Key",
      type: "text",
      placeholder: "pk_xxx",
      group: "stripe",
      tab: "payment",
    },
    {
      name: "stripe_secret_key",
      title: "Secret Key",
      type: "password",
      placeholder: "sk_xxx",
      group: "stripe",
      tab: "payment",
    },
    {
      name: "stripe_signing_secret",
      title: "Webhook Signing Secret",
      type: "password",
      placeholder: "whsec_xxx",
      group: "stripe",
      tab: "payment",
    },

    // Payment / PayPal
    {
      name: "paypal_enabled",
      title: "Enable PayPal",
      type: "switch",
      group: "paypal",
      tab: "payment",
    },
    {
      name: "paypal_client_id",
      title: "Client ID",
      type: "text",
      placeholder: "xxx",
      group: "paypal",
      tab: "payment",
    },
    {
      name: "paypal_client_secret",
      title: "Client Secret",
      type: "password",
      placeholder: "xxx",
      group: "paypal",
      tab: "payment",
    },
    {
      name: "paypal_webhook_id",
      title: "Webhook ID",
      type: "text",
      placeholder: "xxx",
      group: "paypal",
      tab: "payment",
    },
    {
      name: "paypal_environment",
      title: "Environment",
      type: "select",
      options: [
        { label: "Sandbox", value: "sandbox" },
        { label: "Live", value: "live" },
      ],
      group: "paypal",
      tab: "payment",
    },

    // Payment / Alipay
    {
      name: "alipay_enabled",
      title: "Enable Alipay",
      type: "switch",
      group: "alipay",
      tab: "payment",
    },
    {
      name: "alipay_app_id",
      title: "App ID",
      type: "text",
      placeholder: "2021xxx",
      group: "alipay",
      tab: "payment",
    },
    {
      name: "alipay_private_key",
      title: "Private Key (RSA2)",
      type: "textarea",
      placeholder: "MIIEvQIBADANBgkq...",
      group: "alipay",
      tab: "payment",
    },
    {
      name: "alipay_public_key",
      title: "Alipay Public Key",
      type: "textarea",
      placeholder: "MIIBIjANBgkq...",
      group: "alipay",
      tab: "payment",
    },
    {
      name: "alipay_notify_url",
      title: "Notify URL (Webhook)",
      type: "text",
      placeholder: "https://example.com/api/payment/notify/alipay",
      group: "alipay",
      tab: "payment",
    },

    // Payment / WeChat Pay
    {
      name: "wechat_enabled",
      title: "Enable WeChat Pay",
      type: "switch",
      group: "wechat",
      tab: "payment",
    },
    {
      name: "wechat_app_id",
      title: "AppID",
      type: "text",
      placeholder: "wx1234567890",
      group: "wechat",
      tab: "payment",
    },
    {
      name: "wechat_mch_id",
      title: "Merchant ID",
      type: "text",
      placeholder: "1900000001",
      group: "wechat",
      tab: "payment",
    },
    {
      name: "wechat_api_v3_key",
      title: "APIv3 Key",
      type: "password",
      placeholder: "32 chars",
      group: "wechat",
      tab: "payment",
    },
    {
      name: "wechat_private_key",
      title: "Merchant Private Key (PEM)",
      type: "textarea",
      placeholder: "MIIEvgIBADANBgkq...",
      group: "wechat",
      tab: "payment",
    },
    {
      name: "wechat_serial_no",
      title: "Certificate Serial No",
      type: "text",
      placeholder: "xxx",
      group: "wechat",
      tab: "payment",
    },
    {
      name: "wechat_notify_url",
      title: "Notify URL (Webhook)",
      type: "text",
      placeholder: "https://example.com/api/payment/notify/wechat",
      group: "wechat",
      tab: "payment",
    },

    // Email / General
    {
      name: "email_provider",
      title: "Email Provider",
      type: "select",
      options: [
        { label: "Resend", value: "resend" },
        { label: "Cloudflare Email", value: "cloudflare" },
      ],
      group: "email_general",
      tab: "email",
      defaultValue: "resend",
    },

    // Email / Resend
    {
      name: "resend_api_key",
      title: "API Key",
      type: "password",
      placeholder: "re_xxx",
      group: "resend",
      tab: "email",
    },
    {
      name: "resend_sender_email",
      title: "Sender Email",
      type: "text",
      placeholder: "hello@example.com",
      group: "resend",
      tab: "email",
    },

    // Email / Cloudflare Email
    {
      name: "cloudflare_email_api_token",
      title: "API Token",
      type: "password",
      placeholder: "Bearer token with Email Send permission",
      group: "cloudflare_email",
      tab: "email",
    },
    {
      name: "cloudflare_email_account_id",
      title: "Account ID",
      type: "text",
      placeholder: "Cloudflare account ID",
      group: "cloudflare_email",
      tab: "email",
    },
    {
      name: "cloudflare_email_sender_email",
      title: "Sender Email",
      type: "text",
      placeholder: "hello@yourdomain.com",
      group: "cloudflare_email",
      tab: "email",
    },

    // Storage / R2
    {
      name: "r2_access_key",
      title: "Cloudflare Access Key",
      type: "text",
      group: "r2",
      tab: "storage",
    },
    {
      name: "r2_secret_key",
      title: "Cloudflare Secret Key",
      type: "password",
      group: "r2",
      tab: "storage",
    },
    {
      name: "r2_bucket_name",
      title: "Bucket Name",
      type: "text",
      group: "r2",
      tab: "storage",
    },
    {
      name: "r2_upload_path",
      title: "Upload Path",
      type: "text",
      placeholder: "uploads",
      tip: "Path to upload files to; leave empty to use the default. Example: uploads/foo/bar",
      group: "r2",
      tab: "storage",
    },
    {
      name: "r2_endpoint",
      title: "Endpoint",
      type: "text",
      placeholder: "https://<account-id>.r2.cloudflarestorage.com",
      tip: "Leave empty to use the default R2 endpoint",
      group: "r2",
      tab: "storage",
    },
    {
      name: "r2_domain",
      title: "Domain",
      type: "text",
      placeholder: "https://cdn.example.com",
      group: "r2",
      tab: "storage",
    },

    // AI / OpenAI
    {
      name: "openai_base_url",
      title: "Base URL",
      type: "text",
      placeholder: "https://api.openai.com/v1",
      group: "openai",
      tab: "ai",
    },
    {
      name: "openai_api_key",
      title: "API Key",
      type: "password",
      placeholder: "sk-xxx",
      group: "openai",
      tab: "ai",
    },

    // AI / Anthropic
    {
      name: "anthropic_base_url",
      title: "Base URL",
      type: "text",
      placeholder: "https://api.anthropic.com",
      group: "anthropic",
      tab: "ai",
    },
    {
      name: "anthropic_api_key",
      title: "API Key",
      type: "password",
      placeholder: "sk-ant-xxx",
      group: "anthropic",
      tab: "ai",
    },

    // AI / Replicate
    {
      name: "replicate_api_token",
      title: "API Token",
      type: "password",
      placeholder: "r8_xxx",
      group: "replicate",
      tab: "ai",
    },

    // AI / Fal
    {
      name: "fal_api_key",
      title: "API Key",
      type: "password",
      placeholder: "xxx",
      group: "fal",
      tab: "ai",
    },

    // Analytics / Google Analytics
    {
      name: "google_analytics_id",
      title: "Measurement ID",
      type: "text",
      placeholder: "G-XXXXXXXXXX",
      group: "google_analytics",
      tab: "analytics",
    },

    // Analytics / Plausible
    {
      name: "plausible_domain",
      title: "Domain",
      type: "text",
      placeholder: "example.com",
      tip: "The domain registered in your Plausible dashboard",
      group: "plausible",
      tab: "analytics",
    },
    {
      name: "plausible_src",
      title: "Script Src",
      type: "text",
      placeholder: "https://plausible.io/js/script.js",
      tip: "Use https://plausible.io/js/script.js for cloud, or your self-hosted URL",
      group: "plausible",
      tab: "analytics",
    },

    // Customer Service / Crisp
    {
      name: "crisp_enabled",
      title: "Enable Crisp",
      type: "switch",
      group: "crisp",
      tab: "customer_service",
    },
    {
      name: "crisp_website_id",
      title: "Website ID",
      type: "text",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      group: "crisp",
      tab: "customer_service",
    },

    // Customer Service / Tawk.to
    {
      name: "tawk_enabled",
      title: "Enable Tawk.to",
      type: "switch",
      group: "tawk",
      tab: "customer_service",
    },
    {
      name: "tawk_property_id",
      title: "Property ID",
      type: "text",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
      group: "tawk",
      tab: "customer_service",
    },
    {
      name: "tawk_widget_id",
      title: "Widget ID",
      type: "text",
      placeholder: "1xxxxx/default",
      group: "tawk",
      tab: "customer_service",
    },
  ];
}

// 计算一次，供派生数据复用（settings 为静态定义）。
const allSettings = getSettings();

/** name → Setting 映射，供写入校验按键查规则。 */
const settingsByName = new Map<string, Setting>(
  allSettings.map((setting) => [setting.name, setting])
);

/**
 * 预定义默认值（来自 settings 的 defaultValue）：作为 getAllConfigs 的最底层兜底，
 * 覆盖 env 未提供、DB 未写入的开关/选择类项（如 email_auth_enabled=true）。R2.3
 */
const settingDefaults: ConfigMap = {};
for (const setting of allSettings) {
  if (setting.defaultValue !== undefined) {
    settingDefaults[setting.name] = setting.defaultValue;
  }
}

// ─── 环境变量默认（Env defaults，R2.3 兜底源之一）─────────────────────────────

// 服务端配置服务：统一从 process.env 读取（含 Vite 的 VITE_ 公共变量，服务端亦在 process.env 中）。
const procEnv: Record<string, string | undefined> =
  typeof process === "undefined" ? {} : process.env;

const readEnv = (key: string): string | undefined => procEnv[key];

/**
 * 环境变量配置（预定义默认）。缺失的键回退到此处的静态默认值（R2.3）。
 * getAllConfigs 以 { ...settingDefaults, ...envConfigs, ...dbConfigs } 合并，DB 覆盖 env。
 */
export const envConfigs: ConfigMap = {
  // App（公开）
  app_url: readEnv("VITE_APP_URL") ?? "http://localhost:3000",
  app_name: readEnv("VITE_APP_NAME") ?? "OpenStarter",
  app_description: readEnv("VITE_APP_DESCRIPTION") ?? "Ship your SaaS faster",
  app_logo: readEnv("VITE_APP_LOGO") ?? "/logo.svg",

  // 数据库
  database_url: readEnv("DATABASE_URL") ?? "",
  database_auth_token: readEnv("DATABASE_AUTH_TOKEN") ?? "",
  database_provider: readEnv("DATABASE_PROVIDER") ?? "sqlite",
  db_schema: readEnv("DB_SCHEMA") ?? "public",
  db_singleton_enabled: readEnv("DB_SINGLETON_ENABLED") ?? "false",
  db_max_connections: readEnv("DB_MAX_CONNECTIONS") ?? "1",

  // 认证
  auth_url: readEnv("AUTH_URL") ?? readEnv("VITE_APP_URL") ?? "",
  auth_secret: readEnv("AUTH_SECRET") ?? "",

  // 支付 - Stripe
  stripe_secret_key: readEnv("STRIPE_SECRET_KEY") ?? "",
  stripe_publishable_key: readEnv("STRIPE_PUBLISHABLE_KEY") ?? "",
  stripe_signing_secret: readEnv("STRIPE_SIGNING_SECRET") ?? "",

  // 支付 - PayPal
  paypal_client_id: readEnv("PAYPAL_CLIENT_ID") ?? "",
  paypal_client_secret: readEnv("PAYPAL_CLIENT_SECRET") ?? "",
  paypal_webhook_id: readEnv("PAYPAL_WEBHOOK_ID") ?? "",
  paypal_environment: readEnv("PAYPAL_ENVIRONMENT") ?? "sandbox",

  // 支付 - Alipay
  alipay_app_id: readEnv("ALIPAY_APP_ID") ?? "",
  alipay_private_key: readEnv("ALIPAY_PRIVATE_KEY") ?? "",
  alipay_public_key: readEnv("ALIPAY_PUBLIC_KEY") ?? "",
  alipay_notify_url: readEnv("ALIPAY_NOTIFY_URL") ?? "",

  // 支付 - WeChat Pay
  wechat_app_id: readEnv("WECHAT_APP_ID") ?? "",
  wechat_mch_id: readEnv("WECHAT_MCH_ID") ?? "",
  wechat_api_v3_key: readEnv("WECHAT_API_V3_KEY") ?? "",
  wechat_private_key: readEnv("WECHAT_PRIVATE_KEY") ?? "",
  wechat_serial_no: readEnv("WECHAT_SERIAL_NO") ?? "",
  wechat_notify_url: readEnv("WECHAT_NOTIFY_URL") ?? "",

  // 邮件 - Resend
  resend_api_key: readEnv("RESEND_API_KEY") ?? "",
  resend_sender_email:
    readEnv("RESEND_SENDER_EMAIL") ?? readEnv("RESEND_EMAIL_FROM") ?? "",

  // 存储 - S3 / R2
  storage_endpoint: readEnv("STORAGE_ENDPOINT") ?? "",
  storage_region: readEnv("STORAGE_REGION") ?? "auto",
  storage_access_key: readEnv("STORAGE_ACCESS_KEY") ?? "",
  storage_secret_key: readEnv("STORAGE_SECRET_KEY") ?? "",
  storage_bucket: readEnv("STORAGE_BUCKET") ?? "",
  storage_public_domain: readEnv("STORAGE_PUBLIC_DOMAIN") ?? "",
  inline_image_max_kb: readEnv("INLINE_IMAGE_MAX_KB") ?? "2048",

  // AI（Replicate 提供 env 兜底；OpenAI/Anthropic 仅后台配置以避免误用机器环境变量）
  replicate_api_token: readEnv("REPLICATE_API_TOKEN") ?? "",

  // Locale（公开）
  locale: readEnv("VITE_DEFAULT_LOCALE") ?? "en",
};

// ─── 读取（Read，R2.1/R2.3）──────────────────────────────────────────────────

// 1 小时内存缓存：秘密解密与 DB 读取有成本，配置项变动不频繁，故缓存 DB 侧结果。
let cachedConfigs: ConfigMap | null = null;
let cacheTime = 0;
const CACHE_TTL = 3_600_000; // 1 hour

// 连接：惰性获取 `@openstarter/db/server` 的 db() 单例访问器（稳定契约）。
// 运行时 dynamic import 延迟加载，避免在无 DB 环境下于模块加载期触发 db 包的 env 解析；
// db() 自身负责单例缓存（Node）/按请求新建（Cloudflare Workers 的 TCP 驱动）。
async function getDb(): Promise<Database> {
  const { db } = await import("@openstarter/db/server");
  return db();
}

/**
 * 读取 DB 中的配置项（解密秘密项，带 1h 缓存）。
 * 未配置数据库时返回空集合，使 env/默认兜底生效；任何读取/解密异常都不阻断整体读取。
 */
export async function getDbConfigs(): Promise<ConfigMap> {
  const now = Date.now();
  if (cachedConfigs && now - cacheTime < CACHE_TTL) {
    return cachedConfigs;
  }

  // 无数据库连接（且非 d1）——直接返回空集合，交由 env/默认兜底（R2.3）。
  if (!envConfigs.database_url && envConfigs.database_provider !== "d1") {
    return {};
  }

  try {
    const database = await getDb();
    const rows = await database.select().from(config);
    const result: ConfigMap = {};
    for (const row of rows) {
      if (!(row.name && row.value)) {
        continue;
      }

      if (isEncryptedSecret(row.value)) {
        try {
          // crypto 为同步实现；解密失败（如密钥轮换/缺失）时跳过该项，
          // 使 env 值（若有）生效，并告警，不阻断其余配置读取。
          result[row.name] = decryptSecret(row.value);
        } catch (error) {
          logger.warn(`[config] failed to decrypt "${row.name}", skipping`, error);
        }
      } else {
        result[row.name] = row.value;
      }
    }

    cachedConfigs = result;
    cacheTime = now;
    return result;
  } catch (error) {
    logger.warn("[config] failed to read configs from database", error);
    return {};
  }
}

/**
 * 合并读取全部配置：预定义默认 + 环境变量 + 数据库（数据库覆盖环境变量）。R2.1/R2.3
 */
export async function getAllConfigs(): Promise<ConfigMap> {
  const dbConfigs = await getDbConfigs();
  return { ...settingDefaults, ...envConfigs, ...dbConfigs };
}

/** 读取单个配置值（不存在返回 undefined）。 */
export async function getConfig(name: string): Promise<string | undefined> {
  const configs = await getAllConfigs();
  return configs[name];
}

// ─── 安全约束：保护键与秘密键（Security）──────────────────────────────────────

/**
 * 保护键：绝不经后台/DB 配置层写入，只能来自环境变量。
 * 覆盖会话签名密钥与数据库连接等基础设施级机密——阻止「越权改写会话签名密钥/切换数据库连接」。
 */
export const PROTECTED_CONFIG_KEYS: ReadonlySet<string> = new Set([
  "auth_secret",
  "database_url",
  "database_auth_token",
  "database_provider",
  "db_schema",
  "db_singleton_enabled",
  "db_max_connections",
]);

/**
 * 秘密键集合：其值为机密，落库时静态加密、返回后台时掩码。
 * 由 settings 定义派生（password 字段 + 私钥），再以名称模式兜底，
 * 使 env-only 秘密（如 stripe_secret_key）与未来自定义键无需登记即被覆盖。
 */
const SECRET_SETTING_NAMES: ReadonlySet<string> = new Set(
  allSettings
    .filter(
      (setting) =>
        setting.type === "password" || setting.name.endsWith("_private_key")
    )
    .map((setting) => setting.name)
);

const SECRET_KEY_PATTERN =
  /(_secret|_secret_key|_token|_password|_private_key|_api_key|_access_key|_api_v3_key)$/;

/** 判断某配置键是否为秘密键（需加密存储 + 掩码展示）。 */
export function isSecretConfigKey(name: string): boolean {
  return SECRET_SETTING_NAMES.has(name) || SECRET_KEY_PATTERN.test(name);
}

// 掩码前缀：秘密值不会以圆点开头，故可无歧义识别「掩码回传 = 未修改」。
const MASK_PREFIX = "••••••••";

/** 掩码一个秘密值用于展示：足够长时保留末 4 位，否则整体掩码。 */
export function maskConfigValue(value: string): string {
  return value.length > 8 ? `${MASK_PREFIX}${value.slice(-4)}` : MASK_PREFIX;
}

/** 后台回传的掩码值代表「未修改」，写入时应跳过。 */
export function isMaskedConfigValue(value: string): boolean {
  return value.startsWith(MASK_PREFIX);
}

// ─── 写入校验（Validation，R2.5）─────────────────────────────────────────────

/**
 * 依据配置项声明的类型校验写入值；通过返回 null，否则返回可读的失败原因。
 * 空字符串视为「清空/未设置」，一律允许。
 */
function validateSettingValue(setting: Setting, value: string): string | null {
  if (value === "") {
    return null;
  }

  switch (setting.type) {
    case "number": {
      if (!Number.isFinite(Number(value))) {
        return `Setting "${setting.name}" must be a valid number`;
      }
      return null;
    }
    case "switch": {
      if (value !== "true" && value !== "false") {
        return `Setting "${setting.name}" must be "true" or "false"`;
      }
      return null;
    }
    case "select": {
      const options = setting.options ?? [];
      if (options.length > 0 && !options.some((opt) => opt.value === value)) {
        const allowed = options.map((opt) => opt.value).join(", ");
        return `Setting "${setting.name}" must be one of: ${allowed}`;
      }
      return null;
    }
    default:
      return null;
  }
}

// ─── 写入（Save，R2.2/R2.5）──────────────────────────────────────────────────

/**
 * 批量写入配置（upsert）。R2.2/R2.5
 * - 保护键（PROTECTED_CONFIG_KEYS）静默丢弃；
 * - 后台回传的掩码值（未修改）跳过；
 * - 有对应 settings 定义者先按类型校验，失败即抛出可读原因并拒绝整批写入（不落库）；
 * - 秘密键落库前加密。
 *
 * 校验在任何 DB 写入之前完成，故校验失败不会产生任何持久化副作用。
 */
export async function saveConfigs(configs: ConfigMap): Promise<void> {
  const toWrite: { name: string; value: string }[] = [];
  for (const [name, value] of Object.entries(configs)) {
    if (PROTECTED_CONFIG_KEYS.has(name)) {
      continue;
    }
    if (isMaskedConfigValue(value)) {
      continue;
    }

    const setting = settingsByName.get(name);
    if (setting) {
      const reason = validateSettingValue(setting, value);
      if (reason) {
        throw new Error(reason);
      }
    }

    toWrite.push({
      name,
      value: isSecretConfigKey(name) ? encryptSecret(value) : value,
    });
  }

  if (toWrite.length === 0) {
    return;
  }

  const database = await getDb();
  // 每键独立 upsert；并行分发（键彼此唯一、互不冲突），避免循环内 await。
  await Promise.all(
    toWrite.map((entry) =>
      database
        .insert(config)
        .values(entry)
        .onConflictDoUpdate({
          target: config.name,
          set: { value: entry.value },
        })
    )
  );

  // 失效缓存，使后续读取返回新值（R2.2）。
  cachedConfigs = null;
  cacheTime = 0;
}

// ─── 后台安全视图（Admin view）────────────────────────────────────────────────

/**
 * 面向后台设置界面的安全视图：移除保护键、掩码秘密值。
 * 绝不能把 getAllConfigs() 直接下发前端——它含全部 env 秘密的明文。
 */
export async function getAdminConfigs(): Promise<ConfigMap> {
  const configs = await getAllConfigs();
  const result: ConfigMap = {};
  for (const [name, value] of Object.entries(configs)) {
    if (PROTECTED_CONFIG_KEYS.has(name)) {
      continue;
    }
    result[name] =
      isSecretConfigKey(name) && value ? maskConfigValue(value) : value;
  }
  return result;
}
