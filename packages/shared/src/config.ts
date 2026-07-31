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
  defaultValue?: string;
  group: string;
  name: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  tab: string;
  tip?: string;
  title: string;
  type: "text" | "password" | "textarea" | "number" | "switch" | "select";
}

/** 配置分组（归属某个 tab）。 */
export interface SettingGroup {
  description?: string;
  name: string;
  tab: string;
  title: string;
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
      description: "Basic application settings",
      name: "appinfo",
      tab: "general",
      title: "App Info",
    },
    {
      description: "Default role for new users",
      name: "user_role",
      tab: "general",
      title: "User Roles",
    },
    {
      description: "Initial credits for new users",
      name: "credit",
      tab: "general",
      title: "Credits",
    },
    {
      description: "Email/password authentication",
      name: "email_auth",
      tab: "auth",
      title: "Email Auth",
    },
    {
      description: "Google OAuth login",
      name: "google_auth",
      tab: "auth",
      title: "Google Auth",
    },
    {
      description: "GitHub OAuth login",
      name: "github_auth",
      tab: "auth",
      title: "GitHub Auth",
    },
    {
      description: "Sign in with Apple OAuth",
      name: "apple_auth",
      tab: "auth",
      title: "Apple Auth",
    },
    {
      description: "Passwordless email magic link login",
      name: "magic_link_auth",
      tab: "auth",
      title: "Magic Link",
    },
    {
      description: "Passwordless email one-time password login",
      name: "email_otp_auth",
      tab: "auth",
      title: "Email OTP",
    },
    {
      description: "Payment general settings",
      name: "basic_payment",
      tab: "payment",
      title: "Basic",
    },
    {
      description: "Stripe payment gateway",
      name: "stripe",
      tab: "payment",
      title: "Stripe",
    },
    {
      description: "PayPal payment gateway",
      name: "paypal",
      tab: "payment",
      title: "PayPal",
    },
    {
      description: "Creem payment gateway",
      name: "creem",
      tab: "payment",
      title: "Creem",
    },
    {
      description: "Alipay payment gateway (native)",
      name: "alipay",
      tab: "payment",
      title: "Alipay",
    },
    {
      description: "WeChat Pay gateway (native)",
      name: "wechat",
      tab: "payment",
      title: "WeChat Pay",
    },
    {
      description: "Email provider selection",
      name: "email_general",
      tab: "email",
      title: "General",
    },
    {
      description: "Resend email service",
      name: "resend",
      tab: "email",
      title: "Resend",
    },
    {
      description: "Cloudflare Email Service",
      name: "cloudflare_email",
      tab: "email",
      title: "Cloudflare Email",
    },
    {
      description: "Object storage settings",
      name: "r2",
      tab: "storage",
      title: "Cloudflare R2 / S3",
    },
    {
      description: "OpenAI (or compatible) API",
      name: "openai",
      tab: "ai",
      title: "OpenAI",
    },
    {
      description: "Anthropic Claude API",
      name: "anthropic",
      tab: "ai",
      title: "Anthropic",
    },
    {
      description: "Replicate AI API",
      name: "replicate",
      tab: "ai",
      title: "Replicate",
    },
    { description: "Fal AI API", name: "fal", tab: "ai", title: "Fal" },
    {
      description: "Inject gtag.js with the configured Measurement ID",
      name: "google_analytics",
      tab: "analytics",
      title: "Google Analytics",
    },
    {
      description: "Inject plausible.js for self-hosted or cloud Plausible",
      name: "plausible",
      tab: "analytics",
      title: "Plausible",
    },
    {
      description: "Crisp live chat widget",
      name: "crisp",
      tab: "customer_service",
      title: "Crisp",
    },
    {
      description: "Tawk.to live chat widget",
      name: "tawk",
      tab: "customer_service",
      title: "Tawk.to",
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
      group: "appinfo",
      name: "app_name",
      placeholder: "My App",
      tab: "general",
      title: "App Name",
      type: "text",
    },
    {
      group: "appinfo",
      name: "app_description",
      placeholder: "Ship your SaaS faster",
      tab: "general",
      title: "App Description",
      type: "textarea",
    },
    {
      group: "appinfo",
      name: "app_url",
      placeholder: "https://example.com",
      tab: "general",
      title: "App URL",
      type: "text",
    },

    // General / User Roles
    {
      group: "user_role",
      name: "initial_role_enabled",
      tab: "general",
      title: "Auto-assign role for new users",
      type: "switch",
    },
    {
      group: "user_role",
      name: "initial_role_name",
      placeholder: "viewer",
      tab: "general",
      title: "Default role name",
      type: "text",
    },

    // General / Credits
    {
      group: "credit",
      name: "initial_credits_enabled",
      tab: "general",
      title: "Grant credits on signup",
      type: "switch",
    },
    {
      group: "credit",
      name: "initial_credits_amount",
      placeholder: "100",
      tab: "general",
      title: "Credits amount",
      type: "number",
    },
    {
      group: "credit",
      name: "initial_credits_valid_days",
      placeholder: "365",
      tab: "general",
      title: "Valid days",
      type: "number",
    },
    {
      group: "credit",
      name: "initial_credits_description",
      placeholder: "Welcome bonus",
      tab: "general",
      title: "Description",
      type: "text",
    },

    // Auth / Email
    {
      defaultValue: "true",
      group: "email_auth",
      name: "email_auth_enabled",
      tab: "auth",
      title: "Enable email auth",
      type: "switch",
    },
    {
      defaultValue: "false",
      group: "email_auth",
      name: "email_verification_enabled",
      tab: "auth",
      title: "Require email verification on sign up",
      type: "switch",
    },
    {
      defaultValue: "false",
      group: "email_auth",
      name: "invite_code_required",
      tab: "auth",
      title: "Require invite code on sign up",
      type: "switch",
    },

    // Auth / Google
    {
      group: "google_auth",
      name: "google_auth_enabled",
      tab: "auth",
      title: "Enable Google auth",
      type: "switch",
    },
    {
      group: "google_auth",
      name: "google_one_tap_enabled",
      tab: "auth",
      tip: "Show the Google One Tap prompt to signed-out visitors. Requires Client ID.",
      title: "Enable Google One Tap",
      type: "switch",
    },
    {
      group: "google_auth",
      name: "google_client_id",
      placeholder: "xxx.apps.googleusercontent.com",
      tab: "auth",
      title: "Client ID",
      type: "text",
    },
    {
      group: "google_auth",
      name: "google_client_secret",
      placeholder: "GOCSPX-xxx",
      tab: "auth",
      title: "Client Secret",
      type: "password",
    },

    // Auth / GitHub
    {
      group: "github_auth",
      name: "github_auth_enabled",
      tab: "auth",
      title: "Enable GitHub auth",
      type: "switch",
    },
    {
      group: "github_auth",
      name: "github_client_id",
      placeholder: "Ov23xxx",
      tab: "auth",
      title: "Client ID",
      type: "text",
    },
    {
      group: "github_auth",
      name: "github_client_secret",
      placeholder: "xxx",
      tab: "auth",
      title: "Client Secret",
      type: "password",
    },

    // Auth / Apple
    {
      group: "apple_auth",
      name: "apple_auth_enabled",
      tab: "auth",
      title: "Enable Sign in with Apple",
      type: "switch",
    },
    {
      group: "apple_auth",
      name: "apple_client_id",
      placeholder: "com.yourcompany.app",
      tab: "auth",
      title: "Services ID (Client ID)",
      type: "text",
    },
    {
      group: "apple_auth",
      name: "apple_client_secret",
      placeholder: "eyJhbGciOiJFUzI1NiIs...",
      tab: "auth",
      title: "Client Secret (JWT)",
      type: "password",
    },
    {
      group: "apple_auth",
      name: "apple_app_bundle_identifier",
      placeholder: "com.yourcompany.app",
      tab: "auth",
      tip: "Used for native Sign in with Apple flows; on web you may reuse the Services ID.",
      title: "App Bundle Identifier",
      type: "text",
    },

    // Auth / Magic Link
    {
      group: "magic_link_auth",
      name: "magic_link_enabled",
      tab: "auth",
      tip: "Allow passwordless login via a one-time link sent to the user's email.",
      title: "Enable Magic Link",
      type: "switch",
    },
    {
      defaultValue: "1800",
      group: "magic_link_auth",
      name: "magic_link_expires_in",
      placeholder: "1800",
      tab: "auth",
      title: "Link expiry (seconds)",
      type: "number",
    },

    // Auth / Email OTP
    {
      group: "email_otp_auth",
      name: "email_otp_enabled",
      tab: "auth",
      tip: "Allow passwordless login via a one-time code sent to the user's email.",
      title: "Enable Email OTP",
      type: "switch",
    },
    {
      defaultValue: "300",
      group: "email_otp_auth",
      name: "email_otp_expires_in",
      placeholder: "300",
      tab: "auth",
      title: "Code expiry (seconds)",
      type: "number",
    },

    // Payment / Basic
    {
      group: "basic_payment",
      name: "select_payment_enabled",
      tab: "payment",
      title: "Show payment method selector",
      type: "switch",
    },
    {
      group: "basic_payment",
      name: "default_payment_provider",
      options: [
        { label: "Stripe", value: "stripe" },
        { label: "Creem", value: "creem" },
        { label: "PayPal", value: "paypal" },
        { label: "Alipay", value: "alipay" },
        { label: "WeChat Pay", value: "wechat" },
      ],
      tab: "payment",
      title: "Default provider",
      type: "select",
    },

    // Payment / Stripe
    {
      group: "stripe",
      name: "stripe_enabled",
      tab: "payment",
      title: "Enable Stripe",
      type: "switch",
    },
    {
      group: "stripe",
      name: "stripe_publishable_key",
      placeholder: "pk_xxx",
      tab: "payment",
      title: "Publishable Key",
      type: "text",
    },
    {
      group: "stripe",
      name: "stripe_secret_key",
      placeholder: "sk_xxx",
      tab: "payment",
      title: "Secret Key",
      type: "password",
    },
    {
      group: "stripe",
      name: "stripe_signing_secret",
      placeholder: "whsec_xxx",
      tab: "payment",
      title: "Webhook Signing Secret",
      type: "password",
    },

    // Payment / PayPal
    {
      group: "paypal",
      name: "paypal_enabled",
      tab: "payment",
      title: "Enable PayPal",
      type: "switch",
    },
    {
      group: "paypal",
      name: "paypal_client_id",
      placeholder: "xxx",
      tab: "payment",
      title: "Client ID",
      type: "text",
    },
    {
      group: "paypal",
      name: "paypal_client_secret",
      placeholder: "xxx",
      tab: "payment",
      title: "Client Secret",
      type: "password",
    },
    {
      group: "paypal",
      name: "paypal_webhook_id",
      placeholder: "xxx",
      tab: "payment",
      title: "Webhook ID",
      type: "text",
    },
    {
      group: "paypal",
      name: "paypal_environment",
      options: [
        { label: "Sandbox", value: "sandbox" },
        { label: "Live", value: "live" },
      ],
      tab: "payment",
      title: "Environment",
      type: "select",
    },

    // Payment / Alipay
    {
      group: "alipay",
      name: "alipay_enabled",
      tab: "payment",
      title: "Enable Alipay",
      type: "switch",
    },
    {
      group: "alipay",
      name: "alipay_app_id",
      placeholder: "2021xxx",
      tab: "payment",
      title: "App ID",
      type: "text",
    },
    {
      group: "alipay",
      name: "alipay_private_key",
      placeholder: "MIIEvQIBADANBgkq...",
      tab: "payment",
      title: "Private Key (RSA2)",
      type: "textarea",
    },
    {
      group: "alipay",
      name: "alipay_public_key",
      placeholder: "MIIBIjANBgkq...",
      tab: "payment",
      title: "Alipay Public Key",
      type: "textarea",
    },
    {
      group: "alipay",
      name: "alipay_notify_url",
      placeholder: "https://example.com/api/payment/notify/alipay",
      tab: "payment",
      title: "Notify URL (Webhook)",
      type: "text",
    },

    // Payment / WeChat Pay
    {
      group: "wechat",
      name: "wechat_enabled",
      tab: "payment",
      title: "Enable WeChat Pay",
      type: "switch",
    },
    {
      group: "wechat",
      name: "wechat_app_id",
      placeholder: "wx1234567890",
      tab: "payment",
      title: "AppID",
      type: "text",
    },
    {
      group: "wechat",
      name: "wechat_mch_id",
      placeholder: "1900000001",
      tab: "payment",
      title: "Merchant ID",
      type: "text",
    },
    {
      group: "wechat",
      name: "wechat_api_v3_key",
      placeholder: "32 chars",
      tab: "payment",
      title: "APIv3 Key",
      type: "password",
    },
    {
      group: "wechat",
      name: "wechat_private_key",
      placeholder: "MIIEvgIBADANBgkq...",
      tab: "payment",
      title: "Merchant Private Key (PEM)",
      type: "textarea",
    },
    {
      group: "wechat",
      name: "wechat_serial_no",
      placeholder: "xxx",
      tab: "payment",
      title: "Certificate Serial No",
      type: "text",
    },
    {
      group: "wechat",
      name: "wechat_notify_url",
      placeholder: "https://example.com/api/payment/notify/wechat",
      tab: "payment",
      title: "Notify URL (Webhook)",
      type: "text",
    },

    // Payment / Creem
    {
      group: "creem",
      name: "creem_enabled",
      tab: "payment",
      title: "Enable Creem",
      type: "switch",
    },
    {
      defaultValue: "sandbox",
      group: "creem",
      name: "creem_environment",
      options: [
        { label: "Sandbox", value: "sandbox" },
        { label: "Live", value: "live" },
      ],
      tab: "payment",
      title: "Environment",
      type: "select",
    },
    {
      group: "creem",
      name: "creem_api_key",
      placeholder: "cr_xxx",
      tab: "payment",
      title: "API Key",
      type: "password",
    },
    {
      group: "creem",
      name: "creem_signing_secret",
      placeholder: "whsec_xxx",
      tab: "payment",
      title: "Signing Secret",
      type: "password",
    },
    {
      group: "creem",
      name: "creem_product_ids_mapping",
      placeholder: '{"starter_monthly": "prod_xxx"}',
      tab: "payment",
      tip: "JSON map of your internal plan names to Creem product IDs.",
      title: "Product IDs Mapping",
      type: "textarea",
    },
    {
      group: "creem",
      name: "creem_test_amount",
      placeholder: "1",
      tab: "payment",
      tip: "Leave empty to use real amount, 1 = $0.01",
      title: "Test amount (cents)",
      type: "number",
    },

    // Email / General
    {
      defaultValue: "resend",
      group: "email_general",
      name: "email_provider",
      options: [
        { label: "Resend", value: "resend" },
        { label: "Cloudflare Email", value: "cloudflare" },
      ],
      tab: "email",
      title: "Email Provider",
      type: "select",
    },

    // Email / Resend
    {
      group: "resend",
      name: "resend_api_key",
      placeholder: "re_xxx",
      tab: "email",
      title: "API Key",
      type: "password",
    },
    {
      group: "resend",
      name: "resend_sender_email",
      placeholder: "hello@example.com",
      tab: "email",
      title: "Sender Email",
      type: "text",
    },

    // Email / Cloudflare Email
    {
      group: "cloudflare_email",
      name: "cloudflare_email_api_token",
      placeholder: "Bearer token with Email Send permission",
      tab: "email",
      title: "API Token",
      type: "password",
    },
    {
      group: "cloudflare_email",
      name: "cloudflare_email_account_id",
      placeholder: "Cloudflare account ID",
      tab: "email",
      title: "Account ID",
      type: "text",
    },
    {
      group: "cloudflare_email",
      name: "cloudflare_email_sender_email",
      placeholder: "hello@yourdomain.com",
      tab: "email",
      title: "Sender Email",
      type: "text",
    },

    // Storage / R2
    {
      group: "r2",
      name: "r2_access_key",
      tab: "storage",
      title: "Cloudflare Access Key",
      type: "text",
    },
    {
      group: "r2",
      name: "r2_secret_key",
      tab: "storage",
      title: "Cloudflare Secret Key",
      type: "password",
    },
    {
      group: "r2",
      name: "r2_bucket_name",
      tab: "storage",
      title: "Bucket Name",
      type: "text",
    },
    {
      group: "r2",
      name: "r2_upload_path",
      placeholder: "uploads",
      tab: "storage",
      tip: "Path to upload files to; leave empty to use the default. Example: uploads/foo/bar",
      title: "Upload Path",
      type: "text",
    },
    {
      group: "r2",
      name: "r2_endpoint",
      placeholder: "https://<account-id>.r2.cloudflarestorage.com",
      tab: "storage",
      tip: "Leave empty to use the default R2 endpoint",
      title: "Endpoint",
      type: "text",
    },
    {
      group: "r2",
      name: "r2_domain",
      placeholder: "https://cdn.example.com",
      tab: "storage",
      title: "Domain",
      type: "text",
    },

    // AI / OpenAI
    {
      group: "openai",
      name: "openai_base_url",
      placeholder: "https://api.openai.com/v1",
      tab: "ai",
      title: "Base URL",
      type: "text",
    },
    {
      group: "openai",
      name: "openai_api_key",
      placeholder: "sk-xxx",
      tab: "ai",
      title: "API Key",
      type: "password",
    },

    // AI / Anthropic
    {
      group: "anthropic",
      name: "anthropic_base_url",
      placeholder: "https://api.anthropic.com",
      tab: "ai",
      title: "Base URL",
      type: "text",
    },
    {
      group: "anthropic",
      name: "anthropic_api_key",
      placeholder: "sk-ant-xxx",
      tab: "ai",
      title: "API Key",
      type: "password",
    },

    // AI / Replicate
    {
      group: "replicate",
      name: "replicate_api_token",
      placeholder: "r8_xxx",
      tab: "ai",
      title: "API Token",
      type: "password",
    },

    // AI / Fal
    {
      group: "fal",
      name: "fal_api_key",
      placeholder: "xxx",
      tab: "ai",
      title: "API Key",
      type: "password",
    },

    // Analytics / Google Analytics
    {
      group: "google_analytics",
      name: "google_analytics_id",
      placeholder: "G-XXXXXXXXXX",
      tab: "analytics",
      title: "Measurement ID",
      type: "text",
    },

    // Analytics / Plausible
    {
      group: "plausible",
      name: "plausible_domain",
      placeholder: "example.com",
      tab: "analytics",
      tip: "The domain registered in your Plausible dashboard",
      title: "Domain",
      type: "text",
    },
    {
      group: "plausible",
      name: "plausible_src",
      placeholder: "https://plausible.io/js/script.js",
      tab: "analytics",
      tip: "Use https://plausible.io/js/script.js for cloud, or your self-hosted URL",
      title: "Script Src",
      type: "text",
    },

    // Customer Service / Crisp
    {
      group: "crisp",
      name: "crisp_enabled",
      tab: "customer_service",
      title: "Enable Crisp",
      type: "switch",
    },
    {
      group: "crisp",
      name: "crisp_website_id",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      tab: "customer_service",
      title: "Website ID",
      type: "text",
    },

    // Customer Service / Tawk.to
    {
      group: "tawk",
      name: "tawk_enabled",
      tab: "customer_service",
      title: "Enable Tawk.to",
      type: "switch",
    },
    {
      group: "tawk",
      name: "tawk_property_id",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
      tab: "customer_service",
      title: "Property ID",
      type: "text",
    },
    {
      group: "tawk",
      name: "tawk_widget_id",
      placeholder: "1xxxxx/default",
      tab: "customer_service",
      title: "Widget ID",
      type: "text",
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
  // 支付 - Alipay
  alipay_app_id: readEnv("ALIPAY_APP_ID") ?? "",
  alipay_notify_url: readEnv("ALIPAY_NOTIFY_URL") ?? "",
  alipay_private_key: readEnv("ALIPAY_PRIVATE_KEY") ?? "",
  alipay_public_key: readEnv("ALIPAY_PUBLIC_KEY") ?? "",
  app_description: readEnv("VITE_APP_DESCRIPTION") ?? "Ship your SaaS faster",
  app_logo: readEnv("VITE_APP_LOGO") ?? "/logo.svg",
  app_name: readEnv("VITE_APP_NAME") ?? "OpenStarter",
  // App（公开）
  app_url: readEnv("VITE_APP_URL") ?? "http://localhost:3000",
  apple_app_bundle_identifier: readEnv("APPLE_APP_BUNDLE_IDENTIFIER") ?? "",

  // 认证 - Apple Sign in
  apple_client_id: readEnv("APPLE_CLIENT_ID") ?? "",
  apple_client_secret: readEnv("APPLE_CLIENT_SECRET") ?? "",
  auth_secret: readEnv("AUTH_SECRET") ?? "",

  // 认证
  auth_url: readEnv("AUTH_URL") ?? readEnv("VITE_APP_URL") ?? "",

  // 支付 - Creem
  creem_api_key: readEnv("CREEM_API_KEY") ?? "",
  creem_environment: readEnv("CREEM_ENVIRONMENT") ?? "sandbox",
  creem_signing_secret: readEnv("CREEM_SIGNING_SECRET") ?? "",
  database_auth_token: readEnv("DATABASE_AUTH_TOKEN") ?? "",
  database_provider: readEnv("DATABASE_PROVIDER") ?? "sqlite",

  // 数据库
  database_url: readEnv("DATABASE_URL") ?? "",
  db_max_connections: readEnv("DB_MAX_CONNECTIONS") ?? "1",
  db_schema: readEnv("DB_SCHEMA") ?? "public",
  db_singleton_enabled: readEnv("DB_SINGLETON_ENABLED") ?? "false",
  inline_image_max_kb: readEnv("INLINE_IMAGE_MAX_KB") ?? "2048",

  // Locale（公开）
  locale: readEnv("VITE_DEFAULT_LOCALE") ?? "en",

  // 支付 - PayPal
  paypal_client_id: readEnv("PAYPAL_CLIENT_ID") ?? "",
  paypal_client_secret: readEnv("PAYPAL_CLIENT_SECRET") ?? "",
  paypal_environment: readEnv("PAYPAL_ENVIRONMENT") ?? "sandbox",
  paypal_webhook_id: readEnv("PAYPAL_WEBHOOK_ID") ?? "",

  // AI（Replicate 提供 env 兜底；OpenAI/Anthropic 仅后台配置以避免误用机器环境变量）
  replicate_api_token: readEnv("REPLICATE_API_TOKEN") ?? "",

  // 邮件 - Resend
  resend_api_key: readEnv("RESEND_API_KEY") ?? "",
  resend_sender_email:
    readEnv("RESEND_SENDER_EMAIL") ?? readEnv("RESEND_EMAIL_FROM") ?? "",
  storage_access_key: readEnv("STORAGE_ACCESS_KEY") ?? "",
  storage_bucket: readEnv("STORAGE_BUCKET") ?? "",

  // 存储 - S3 / R2
  storage_endpoint: readEnv("STORAGE_ENDPOINT") ?? "",
  storage_public_domain: readEnv("STORAGE_PUBLIC_DOMAIN") ?? "",
  storage_region: readEnv("STORAGE_REGION") ?? "auto",
  storage_secret_key: readEnv("STORAGE_SECRET_KEY") ?? "",
  stripe_publishable_key: readEnv("STRIPE_PUBLISHABLE_KEY") ?? "",

  // 支付 - Stripe
  stripe_secret_key: readEnv("STRIPE_SECRET_KEY") ?? "",
  stripe_signing_secret: readEnv("STRIPE_SIGNING_SECRET") ?? "",
  wechat_api_v3_key: readEnv("WECHAT_API_V3_KEY") ?? "",

  // 支付 - WeChat Pay
  wechat_app_id: readEnv("WECHAT_APP_ID") ?? "",
  wechat_mch_id: readEnv("WECHAT_MCH_ID") ?? "",
  wechat_notify_url: readEnv("WECHAT_NOTIFY_URL") ?? "",
  wechat_private_key: readEnv("WECHAT_PRIVATE_KEY") ?? "",
  wechat_serial_no: readEnv("WECHAT_SERIAL_NO") ?? "",
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
          logger.warn(
            `[config] failed to decrypt "${row.name}", skipping`,
            error
          );
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
          set: { value: entry.value },
          target: config.name,
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
