// packages/api/src/routes/config —— 公开配置端点（服务前端登录页的 OAuth 入口展示，R5.3）。
//
// 仅下发**白名单**内的公开配置项（绝不使用 getAdminConfigs 之外的敏感项），
// 供 `apps/web` 登录/注册页依据 Config 启用集合决定展示哪些 OAuth 按钮与邮箱能力。
// 另派生 `password_reset_enabled` / `email_verification_enabled`（需邮件渠道已配置方为真）。

import { getAllConfigs } from "@openstarter/shared/config";
import { respData } from "@openstarter/shared";
import { Hono } from "hono";

// 允许下发前端的公开键（仅认证相关的非敏感开关与 Google One Tap 的 client id）。
const PUBLIC_AUTH_KEYS = [
  "email_auth_enabled",
  "google_auth_enabled",
  "google_one_tap_enabled",
  "google_client_id",
  "github_auth_enabled",
  "invite_code_required",
] as const;

/** 邮件发送渠道是否已配置（决定密码重置/邮箱验证在前端是否可用）。 */
function isEmailSendingConfigured(configs: Record<string, string>): boolean {
  const provider = configs.email_provider || "resend";
  if (provider === "cloudflare") {
    return Boolean(
      configs.cloudflare_email_api_token &&
        configs.cloudflare_email_account_id &&
        configs.cloudflare_email_sender_email
    );
  }
  return Boolean(configs.resend_api_key && configs.resend_sender_email);
}

export const configRoute = new Hono().get("/api/config/public", async (c) => {
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
    configs.email_auth_enabled !== "false" && emailConfigured
      ? "true"
      : "false";
  result.email_verification_enabled =
    configs.email_verification_enabled === "true" && emailConfigured
      ? "true"
      : "false";

  return c.json(respData(result));
});
