// EmailTemplate.DELETE_ACCOUNT —— 删账号确认邮件。
// Auth 触发点：user.deleteUser.sendDeleteAccountVerification（变量：url）。
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
    preview: "Confirm your account deletion",
    title: "Confirm account deletion",
    intro: (app: string) =>
      `We received a request to permanently delete your ${app} account. Confirm below to remove your account and all associated data.`,
    button: "Delete my account",
    expiry: "This link will expire in 24 hours.",
    fallbackIntro:
      "If the button doesn't work, copy and paste this link into your browser:",
    footer:
      "If you didn't request this, you can safely ignore this email and your account will stay active.",
  },
  zh: {
    preview: "确认删除你的账号",
    title: "确认删除账号",
    intro: (app: string) =>
      `我们收到永久删除你 ${app} 账号的请求。点击下方按钮将删除你的账号及全部相关数据。`,
    button: "删除我的账号",
    expiry: "此链接将在 24 小时后失效。",
    fallbackIntro: "如果按钮无法点击，请复制以下链接到浏览器打开：",
    footer: "若你并未发起此请求，可忽略本邮件，你的账号将保持有效。",
  },
} as const;

type DeleteAccountEmailProps = {
  readonly url: string;
  readonly locale: string;
  readonly appName?: string;
};

export const DeleteAccountEmail = ({
  url,
  locale,
  appName = "OpenStarter",
}: DeleteAccountEmailProps) => {
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
