// @openstarter/email/server —— 事务性邮件服务端入口（Email_Service，R22）。
//
// 导出 sendEmail / EmailManager / EmailProvider，精确满足 Auth_Service 现有引用
// （packages/auth/src/server.ts 的 `import { sendEmail } from "@openstarter/email/server"`）。
//
// 依赖分层：位于 auth 依赖层之下，仅向下依赖 @openstarter/shared（logger、Config 读取渠道凭证），
// 模板本地化复用本包 ./templates/locale（零外部依赖）。**不依赖 packages/api、packages/auth**，
// 杜绝环依赖（对应 ultracite「prevent import cycles」）。
//
// 渠道：Resend 为主、Cloudflare 邮件通道为备选（R22.1）。两者均以 fetch 调用各自 HTTP API，
// 不引入 SDK 依赖，Node 与 Cloudflare Workers 运行时通用。渠道文案与凭证完善见阶段 5。
//
// 失败与日志（R22.4）：sendEmail 以结构化 EmailSendResult 回传成功/失败；投递失败经
// @openstarter/shared/logger 记录、**不抛未捕获异常**（渲染/网络异常一并被捕获转为失败结果）。

import { render } from "@react-email/components";
import { createElement, type ReactElement } from "react";

import type { ConfigMap } from "@openstarter/shared/config";
import { getAllConfigs } from "@openstarter/shared/config";
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

// ─── 类型（Types）──────────────────────────────────────────────────────────

/** 单封邮件的投递载荷（已渲染）。 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

/** 投递结果信封：无论成功/失败均结构化返回，便于调用方与日志追溯（R22.3）。 */
export type EmailSendResult = {
  success: boolean;
  /** 实际投递渠道名（none 表示无可用渠道）。 */
  provider: string;
  /** 成功时的渠道消息 id（部分渠道无返回则省略）。 */
  messageId?: string;
  /** 失败时的可读错误信息。 */
  error?: string;
};

/** 邮件渠道抽象：一个具名的可投递渠道（Resend / Cloudflare 等）。 */
export type EmailProvider = {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
};

/** sendEmail 顶层入参：渲染指定模板并投递。 */
export type SendEmailParams = {
  to: string;
  template: EmailTemplate;
  locale: string;
  variables: Record<string, string>;
};

// ─── 模板渲染（Rendering，R22.2/R22.5）──────────────────────────────────────

// 兜底应用名（Config 未提供 app_name 时使用）。
const DEFAULT_APP_NAME = "OpenStarter";

// 穷尽性守卫：EmailTemplate 联合已在上方 switch 全部覆盖，运行时非法值在此抛出（由 sendEmail 捕获）。
const assertNeverTemplate = (value: never): never => {
  throw new Error(`Unhandled email template: ${String(value)}`);
};

/**
 * 依模板类型构造对应的 React Email 元素。
 * 各模板按 locale 选择文案（模板内部经 resolveEmailLocale 收敛）。
 * variables 为字符串键值，缺失键以空串兜底，避免渲染期抛错。
 */
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

// 各模板的主题行（按 en/zh 本地化，与模板 preview/文案一致）。
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

// 依 locale 取主题行（locale 经 resolveEmailLocale 收敛为 en/zh）。
const getSubject = (template: EmailTemplate, locale: string): string =>
  SUBJECTS[template][resolveEmailLocale(locale)];

// ─── 渠道实现（Providers，R22.1）─────────────────────────────────────────────

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Cloudflare 邮件通道经 MailChannels 事务发送 API（Cloudflare Workers 邮件的标准路径）。
const CLOUDFLARE_EMAIL_ENDPOINT = "https://api.mailchannels.net/tx/v1/send";

// 安全读取错误响应体：读取失败时回落到状态码描述，绝不抛出。
const readErrorDetail = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    return text.trim() === "" ? `HTTP ${response.status}` : text;
  } catch {
    return `HTTP ${response.status}`;
  }
};

// 归一化异常为可读信息（用于日志与 EmailSendResult.error）。
const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Resend 渠道（主）：POST /emails，Bearer 鉴权。成功返回 `{ id }`。
 * 任何失败（非 2xx 或网络异常）都记日志并返回失败结果，不抛出。
 */
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

/**
 * Cloudflare 邮件通道（备选）：经 MailChannels 事务发送 API。
 * 同样以失败结果 + 日志处理任何异常，不抛出。
 */
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

// ─── 渠道管理器（EmailManager，R22.1）────────────────────────────────────────

/**
 * 邮件渠道管理器：注册若干渠道并按默认渠道投递。
 * 首个注册的渠道或显式标记者成为默认渠道；无默认渠道时投递返回失败结果（不抛出）。
 */
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

/**
 * 依 Config 装配渠道管理器：
 * - `email_provider` 选择默认渠道（缺省 resend）；
 * - Resend 需 `resend_api_key` + `resend_sender_email`；
 * - Cloudflare 需 `cloudflare_email_api_token` + `cloudflare_email_sender_email`。
 * 凭证缺失的渠道不注册；两者皆缺时管理器无默认渠道，投递将返回失败结果。
 */
const buildManagerFromConfig = (configs: ConfigMap): EmailManager => {
  const manager = new EmailManager();
  const selected = configs.email_provider ?? "resend";

  const resendApiKey = configs.resend_api_key ?? "";
  const resendFrom = configs.resend_sender_email ?? "";
  if (resendApiKey && resendFrom) {
    manager.addProvider(createResendProvider(resendApiKey, resendFrom), selected === "resend");
  }

  const cloudflareToken = configs.cloudflare_email_api_token ?? "";
  const cloudflareFrom = configs.cloudflare_email_sender_email ?? "";
  if (cloudflareToken && cloudflareFrom) {
    manager.addProvider(
      createCloudflareProvider(cloudflareToken, cloudflareFrom),
      selected === "cloudflare",
    );
  }

  return manager;
};

// ─── 服务端入口（sendEmail，R22.3/R22.4/R22.5）──────────────────────────────

/**
 * 渲染指定模板并经默认渠道投递事务性邮件。
 *
 * - 读取 Config 获取渠道凭证与 app_name（DB/env 双源，缺失优雅降级）；
 * - 按 locale 渲染对应模板（R22.5）；
 * - 以结构化 EmailSendResult 回传（R22.3）；
 * - 渠道未配置 / 渲染或投递失败：记日志并返回失败结果，**不抛未捕获异常**（R22.4）。
 */
export const sendEmail = async (params: SendEmailParams): Promise<EmailSendResult> => {
  try {
    const configs = await getAllConfigs();
    const appName = configs.app_name || DEFAULT_APP_NAME;
    const manager = buildManagerFromConfig(configs);

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
