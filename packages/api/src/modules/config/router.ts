// packages/api/src/modules/config —— 公开配置端点（R5.3 + R25.1/R25.2 分析配置数据面）。
//
// 仅下发**白名单**内的公开配置项（绝不使用 getAdminConfigs 之外的敏感项）：
//   - GET /api/config/public：登录/注册页 OAuth 入口展示（R5.3）。
//   - GET /api/analytics/config：分析供应商标识与度量 ID，供 apps/web 条件注入采集脚本
//     （R25.1/R25.2）。分析度量 ID 本就随页面 HTML 公开，经公开只读端点下发不涉密。

import { respData } from "@openstarter/shared";
import { getAllConfigs } from "@openstarter/shared/config";
import { Hono } from "hono";

import { getPublicAnalyticsConfig } from "../admin/analytics";

// 允许下发前端的公开键(仅认证相关的非敏感开关与 Apple/Google client id)。
const PUBLIC_AUTH_KEYS = [
  "email_auth_enabled",
  "google_auth_enabled",
  "google_one_tap_enabled",
  "google_client_id",
  "github_auth_enabled",
  "apple_auth_enabled",
  "apple_client_id",
  "magic_link_enabled",
  "email_otp_enabled",
  "invite_code_required",
] as const;

/** 邮件发送渠道是否已配置（决定密码重置/邮箱验证在前端是否可用）。 */
function isEmailSendingConfigured(configs: Record<string, string>): boolean {
  const provider = configs.email_provider || "resend";
  if (provider === "cloudflare") {
    return Boolean(
      configs.cloudflare_email_api_token &&
      configs.cloudflare_email_account_id &&
      configs.cloudflare_email_sender_email,
    );
  }
  return Boolean(configs.resend_api_key && configs.resend_sender_email);
}

export const configRouter = new Hono()
  .get("/config/public", async (c) => {
    const configs = await getAllConfigs();

    const result: Record<string, string> = {};
    for (const key of PUBLIC_AUTH_KEYS) {
      const value = configs[key];
      if (value !== undefined) {
        result[key] = value;
      }
    }

    const emailConfigured = isEmailSendingConfigured(configs);
    result.password_reset_enabled =
      configs.email_auth_enabled !== "false" && emailConfigured ? "true" : "false";
    result.email_verification_enabled =
      configs.email_verification_enabled === "true" && emailConfigured ? "true" : "false";

    return c.json(respData(result));
  })
  .get("/analytics/config", async (c) => {
    const config = await getPublicAnalyticsConfig();
    return c.json(respData(config));
  });
