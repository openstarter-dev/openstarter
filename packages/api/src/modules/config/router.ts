import { respData } from "@openstarter/shared";
import { getAllConfigs } from "@openstarter/shared/config";
import { Hono } from "hono";

import { getPublicAnalyticsConfig } from "../admin/analytics";

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
  "anonymous_auth_enabled",
  "invite_code_required",
  "revenuecat_enabled",
] as const;

function isEmailSendingConfigured(configs: Record<string, string>): boolean {
  const provider = configs.email_provider || "resend";
  if (provider === "cloudflare") {
    // MailChannels only requires API token + sender email (aligned with @openstarter/email)
    // MailChannels 通道仅需 API token 与发件邮箱（与 @openstarter/email 保持一致）
    return Boolean(configs.cloudflare_email_api_token && configs.cloudflare_email_sender_email);
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
