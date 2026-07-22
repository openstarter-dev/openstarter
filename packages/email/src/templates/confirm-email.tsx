// EmailTemplate.CONFIRM_EMAIL —— 邮箱验证邮件。
// Auth 触发点：emailVerification.sendVerificationEmail（变量：url）。
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
    preview: "Verify your email address",
    title: "Verify your email",
    intro: (app: string) =>
      `Click the button below to verify your email address and finish signing in to ${app}.`,
    button: "Verify email",
    expiry: "This link will expire in 24 hours.",
    fallbackIntro:
      "If the button doesn't work, copy and paste this link into your browser:",
    footer: "If you didn't create an account, you can safely ignore this email.",
  },
  zh: {
    preview: "验证你的邮箱地址",
    title: "验证你的邮箱",
    intro: (app: string) =>
      `点击下方按钮验证你的邮箱地址，即可完成登录 ${app}。`,
    button: "验证邮箱",
    expiry: "此链接将在 24 小时后失效。",
    fallbackIntro: "如果按钮无法点击，请复制以下链接到浏览器打开：",
    footer: "若你并未注册账号，可忽略本邮件。",
  },
} as const;

type ConfirmEmailProps = {
  readonly url: string;
  readonly locale: string;
  readonly appName?: string;
};

export const ConfirmEmail = ({
  url,
  locale,
  appName = "OpenStarter",
}: ConfirmEmailProps) => {
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
