// EmailTemplate.CHANGE_EMAIL —— 改邮箱确认邮件。
// Auth 触发点：user.changeEmail.sendChangeEmailConfirmation（变量：url、newEmail）。
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
    preview: "Confirm your new email address",
    title: "Confirm your new email",
    intro: (app: string, newEmail: string) =>
      `You requested to change your ${app} email address to ${newEmail}. Confirm below to apply the change.`,
    button: "Confirm new email",
    expiry: "This link will expire in 24 hours.",
    fallbackIntro: "If the button doesn't work, copy and paste this link into your browser:",
    footer:
      "If you didn't request this change, you can safely ignore this email and your email will stay the same.",
  },
  zh: {
    preview: "确认你的新邮箱地址",
    title: "确认你的新邮箱",
    intro: (app: string, newEmail: string) =>
      `你请求将 ${app} 的邮箱地址修改为 ${newEmail}。点击下方按钮确认此变更。`,
    button: "确认新邮箱",
    expiry: "此链接将在 24 小时后失效。",
    fallbackIntro: "如果按钮无法点击，请复制以下链接到浏览器打开：",
    footer: "若你并未申请此变更，可忽略本邮件，你的邮箱将保持不变。",
  },
} as const;

type ChangeEmailProps = {
  readonly url: string;
  readonly newEmail: string;
  readonly locale: string;
  readonly appName?: string;
};

export const ChangeEmail = ({
  url,
  newEmail,
  locale,
  appName = "OpenStarter",
}: ChangeEmailProps) => {
  const resolved = resolveEmailLocale(locale);
  const c = copy[resolved];

  return (
    <EmailLayout appName={appName} lang={resolved} preview={c.preview}>
      <Title>{c.title}</Title>
      <Paragraph>{c.intro(appName, newEmail)}</Paragraph>
      <ActionButton href={url} label={c.button} />
      <ExpiryNote>{c.expiry}</ExpiryNote>
      <FallbackLink intro={c.fallbackIntro} url={url} />
      <Footnote>{c.footer}</Footnote>
    </EmailLayout>
  );
};
