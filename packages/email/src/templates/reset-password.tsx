// EmailTemplate.RESET_PASSWORD —— 密码重置邮件。
// Auth 触发点：emailAndPassword.sendResetPassword（变量：url）。
// Requirements: 22.2、22.5。

import {
  ActionButton,
  EmailLayout,
  ExpiryNote,
  FallbackLink,
  Footnote,
  Paragraph,
  Title,
} from "./layout";
import { resolveEmailLocale } from "./locale";

const copy = {
  en: {
    preview: "Reset your password",
    title: "Reset your password",
    intro: (app: string) =>
      `We received a request to reset the password for your ${app} account. Click the button below to choose a new password.`,
    button: "Reset password",
    expiry: "This link will expire in 1 hour.",
    fallbackIntro:
      "If the button doesn't work, copy and paste this link into your browser:",
    footer:
      "If you didn't request a password reset, you can safely ignore this email.",
  },
  zh: {
    preview: "重置你的密码",
    title: "重置你的密码",
    intro: (app: string) =>
      `我们收到重置你 ${app} 账号密码的请求。点击下方按钮设置新密码。`,
    button: "重置密码",
    expiry: "此链接将在 1 小时后失效。",
    fallbackIntro: "如果按钮无法点击，请复制以下链接到浏览器打开：",
    footer: "若你并未申请重置密码，可忽略本邮件。",
  },
} as const;

type ResetPasswordEmailProps = {
  readonly url: string;
  readonly locale: string;
  readonly appName?: string;
};

export const ResetPasswordEmail = ({
  url,
  locale,
  appName = "OpenStarter",
}: ResetPasswordEmailProps) => {
  const resolved = resolveEmailLocale(locale);
  const c = copy[resolved];

  return (
    <EmailLayout appName={appName} lang={resolved} preview={c.preview}>
      <Title>{c.title}</Title>
      <Paragraph>{c.intro(appName)}</Paragraph>
      <ActionButton href={url} label={c.button} />
      <ExpiryNote>{c.expiry}</ExpiryNote>
      <FallbackLink intro={c.fallbackIntro} url={url} />
      <Footnote>{c.footer}</Footnote>
    </EmailLayout>
  );
};
