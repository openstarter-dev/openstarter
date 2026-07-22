// EmailTemplate.ORGANIZATION_INVITATION —— 组织邀请邮件。
// Auth 触发点：organization.sendInvitationEmail（变量：url、inviter、organization）。
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
    preview: "You've been invited to join a team",
    title: "You're invited",
    intro: (inviter: string, organization: string) =>
      `${inviter} has invited you to join ${organization}. Accept the invitation below to get started.`,
    button: "Accept invitation",
    expiry: "This invitation will expire in 48 hours.",
    fallbackIntro:
      "If the button doesn't work, copy and paste this link into your browser:",
    footer:
      "If you weren't expecting this invitation, you can safely ignore this email.",
  },
  zh: {
    preview: "你被邀请加入一个团队",
    title: "你收到一份邀请",
    intro: (inviter: string, organization: string) =>
      `${inviter} 邀请你加入 ${organization}。点击下方按钮接受邀请即可开始。`,
    button: "接受邀请",
    expiry: "此邀请将在 48 小时后失效。",
    fallbackIntro: "如果按钮无法点击，请复制以下链接到浏览器打开：",
    footer: "若你并未预期收到此邀请，可忽略本邮件。",
  },
} as const;

type OrganizationInvitationEmailProps = {
  readonly url: string;
  readonly inviter: string;
  readonly organization: string;
  readonly locale: string;
  readonly appName?: string;
};

export const OrganizationInvitationEmail = ({
  url,
  inviter,
  organization,
  locale,
  appName = "OpenStarter",
}: OrganizationInvitationEmailProps) => {
  const resolved = resolveEmailLocale(locale);
  const c = copy[resolved];

  return (
    <EmailLayout appName={appName} lang={resolved} preview={c.preview}>
      <Title>{c.title}</Title>
      <Paragraph>{c.intro(inviter, organization)}</Paragraph>
      <ActionButton href={url} label={c.button} />
      <ExpiryNote>{c.expiry}</ExpiryNote>
      <FallbackLink intro={c.fallbackIntro} url={url} />
      <Footnote>{c.footer}</Footnote>
    </EmailLayout>
  );
};
