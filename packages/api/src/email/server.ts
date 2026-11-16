import { render } from "@react-email/components";
import { createElement, type ReactElement } from "react";

import { logger } from "@openstarter/shared/logger";

import { EmailTemplate } from "./index";
import { ChangeEmail } from "./templates/change-email";
import { ConfirmEmail } from "./templates/confirm-email";
import { DeleteAccountEmail } from "./templates/delete-account";
import { type EmailLocale, resolveEmailLocale } from "./templates/locale";
import { MagicLinkEmail } from "./templates/magic-link";
import { OrganizationInvitationEmail } from "./templates/organization-invitation";
import { ResetPasswordEmail } from "./templates/reset-password";
import { SignInOtpEmail } from "./templates/sign-in-otp";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

export type EmailSendResult = {
  success: boolean;

  provider: string;

  messageId?: string;

  error?: string;
};

export type EmailProvider = {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
};

export type SendEmailParams = {
  to: string;
  template: EmailTemplate;
  locale: string;
  variables: Record<string, string>;
};

const DEFAULT_APP_NAME = "OpenStarter";

const assertNeverTemplate = (value: never): never => {
  throw new Error(`Unhandled email template: ${String(value)}`);
};

const buildTemplateElement = (
  template: EmailTemplate,
  locale: string,
  variables: Record<string, string>,
  appName: string,
): ReactElement => {
  const url = variables.url ?? "";
  switch (template) {
    case EmailTemplate.DELETE_ACCOUNT:
      return createElement(DeleteAccountEmail, { url, locale, appName });
    case EmailTemplate.CHANGE_EMAIL:
      return createElement(ChangeEmail, {
        url,
        newEmail: variables.newEmail ?? "",
        locale,
        appName,
      });
    case EmailTemplate.CONFIRM_EMAIL:
      return createElement(ConfirmEmail, { url, locale, appName });
    case EmailTemplate.RESET_PASSWORD:
      return createElement(ResetPasswordEmail, { url, locale, appName });
    case EmailTemplate.MAGIC_LINK:
      return createElement(MagicLinkEmail, { url, locale, appName });
    case EmailTemplate.SIGN_IN_OTP:
      return createElement(SignInOtpEmail, {
        otp: variables.otp ?? "",
        locale,
        appName,
      });
    case EmailTemplate.ORGANIZATION_INVITATION:
      return createElement(OrganizationInvitationEmail, {
        url,
        inviter: variables.inviter ?? "",
        organization: variables.organization ?? "",
        locale,
        appName,
      });
    default:
      return assertNeverTemplate(template);
  }
};

const SUBJECTS: Record<EmailTemplate, Record<EmailLocale, string>> = {
  [EmailTemplate.DELETE_ACCOUNT]: {
    en: "Confirm your account deletion",
    zh: "确认删除你的账号",
  },
  [EmailTemplate.CHANGE_EMAIL]: {
    en: "Confirm your new email address",
    zh: "确认你的新邮箱地址",
  },
  [EmailTemplate.CONFIRM_EMAIL]: {
    en: "Verify your email address",
    zh: "验证你的邮箱地址",
  },
  [EmailTemplate.RESET_PASSWORD]: {
    en: "Reset your password",
    zh: "重置你的密码",
  },
  [EmailTemplate.MAGIC_LINK]: {
    en: "Your sign-in link",
    zh: "你的登录链接",
  },
  [EmailTemplate.SIGN_IN_OTP]: {
    en: "Your sign-in code",
    zh: "你的登录验证码",
  },
  [EmailTemplate.ORGANIZATION_INVITATION]: {
    en: "You've been invited to join a team",
    zh: "你被邀请加入一个团队",
  },
};

const getSubject = (template: EmailTemplate, locale: string): string =>
  SUBJECTS[template][resolveEmailLocale(locale)];

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const CLOUDFLARE_EMAIL_ENDPOINT = "https://api.mailchannels.net/tx/v1/send";

const readErrorDetail = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    return text.trim() === "" ? `HTTP ${response.status}` : text;
  } catch {
    return `HTTP ${response.status}`;
  }
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const createResendProvider = (apiKey: string, from: string): EmailProvider => ({
  name: "resend",
  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        }),
      });

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        logger.error(`[email] resend delivery failed (status ${response.status})`, detail);
        return { success: false, provider: "resend", error: detail };
      }

      const data = (await response.json()) as { id?: string };
      return { success: true, provider: "resend", messageId: data.id };
    } catch (error) {
      const detail = toErrorMessage(error);
      logger.error("[email] resend delivery threw", detail);
      return { success: false, provider: "resend", error: detail };
    }
  },
});

const createCloudflareProvider = (apiKey: string, from: string): EmailProvider => ({
  name: "cloudflare",
  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch(CLOUDFLARE_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: from },
          subject: message.subject,
          content: [{ type: "text/html", value: message.html }],
        }),
      });

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        logger.error(`[email] cloudflare delivery failed (status ${response.status})`, detail);
        return { success: false, provider: "cloudflare", error: detail };
      }

      return { success: true, provider: "cloudflare" };
    } catch (error) {
      const detail = toErrorMessage(error);
      logger.error("[email] cloudflare delivery threw", detail);
      return { success: false, provider: "cloudflare", error: detail };
    }
  },
});

export class EmailManager {
  readonly #providers = new Map<string, EmailProvider>();
  #defaultProvider: string | null = null;

  addProvider(provider: EmailProvider, isDefault = false): void {
    this.#providers.set(provider.name, provider);
    if (isDefault || this.#defaultProvider === null) {
      this.#defaultProvider = provider.name;
    }
  }

  getProvider(name: string): EmailProvider | undefined {
    return this.#providers.get(name);
  }

  sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    if (this.#defaultProvider === null) {
      const error = "no email provider configured";
      logger.error(`[email] ${error}`);
      return Promise.resolve({ success: false, provider: "none", error });
    }

    const provider = this.#providers.get(this.#defaultProvider);
    if (!provider) {
      const error = `email provider "${this.#defaultProvider}" not found`;
      logger.error(`[email] ${error}`);
      return Promise.resolve({
        success: false,
        provider: this.#defaultProvider,
        error,
      });
    }

    return provider.sendEmail(message);
  }
}

const readEnv = (key: string): string => {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  if (typeof fromProcess === "string") {
    return fromProcess.trim();
  }
  const cfEnv = (globalThis as { __CF_ENV__?: Record<string, unknown> }).__CF_ENV__;
  const fromCf = cfEnv?.[key];
  return typeof fromCf === "string" ? fromCf.trim() : "";
};

const buildManagerFromEnv = (): EmailManager => {
  const manager = new EmailManager();
  const selected = readEnv("EMAIL_PROVIDER") || "resend";
  const sharedFrom = readEnv("EMAIL_FROM");

  const resendApiKey = readEnv("RESEND_API_KEY");
  const resendFrom = readEnv("RESEND_SENDER_EMAIL") || readEnv("RESEND_EMAIL_FROM") || sharedFrom;
  if (resendApiKey && resendFrom) {
    manager.addProvider(createResendProvider(resendApiKey, resendFrom), selected === "resend");
  }

  const cloudflareToken = readEnv("CLOUDFLARE_EMAIL_API_TOKEN");
  const cloudflareFrom = readEnv("CLOUDFLARE_EMAIL_SENDER_EMAIL") || sharedFrom;
  if (cloudflareToken && cloudflareFrom) {
    manager.addProvider(
      createCloudflareProvider(cloudflareToken, cloudflareFrom),
      selected === "cloudflare",
    );
  }

  return manager;
};

export const sendEmail = async (params: SendEmailParams): Promise<EmailSendResult> => {
  try {
    const appName = readEnv("VITE_APP_NAME") || readEnv("APP_NAME") || DEFAULT_APP_NAME;
    const manager = buildManagerFromEnv();

    const element = buildTemplateElement(params.template, params.locale, params.variables, appName);
    const html = await render(element);
    const subject = getSubject(params.template, params.locale);

    return await manager.sendEmail({ to: params.to, subject, html });
  } catch (error) {
    const detail = toErrorMessage(error);
    logger.error("[email] failed to send email", detail);
    return { success: false, provider: "unknown", error: detail };
  }
};
