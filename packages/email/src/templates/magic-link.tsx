// EmailTemplate.MAGIC_LINK —— magic link 登录邮件。
// Auth 触发点：magicLink.sendMagicLink（变量：url）。
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
    preview: "Your sign-in link",
    title: "Sign in with a magic link",
    intro: (app: string) =>
      `Click the button below to securely sign in to ${app}. No password required.`,
    button: "Sign in",
    expiry: "This link will expire in 15 minutes and can be used once.",
    fallbackIntro: "If the button doesn't work, copy and paste this link into your browser:",
    footer: "If you didn't try to sign in, you can safely ignore this email.",
  },
  zh: {
    preview: "你的登录链接",
    title: "使用魔法链接登录",
    intro: (app: string) => `点击下方按钮即可安全登录 ${app}，无需输入密码。`,
    button: "登录",
    expiry: "此链接将在 15 分钟后失效，且仅可使用一次。",
    fallbackIntro: "如果按钮无法点击，请复制以下链接到浏览器打开：",
    footer: "若你并未尝试登录，可忽略本邮件。",
  },
} as const;

type MagicLinkEmailProps = {
  readonly url: string;
  readonly locale: string;
  readonly appName?: string;
};

export const MagicLinkEmail = ({ url, locale, appName = "OpenStarter" }: MagicLinkEmailProps) => {
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
