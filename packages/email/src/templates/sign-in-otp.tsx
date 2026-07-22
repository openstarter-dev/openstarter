// EmailTemplate.SIGN_IN_OTP —— 登录一次性验证码邮件。
// Auth 触发点：emailOTP.sendVerificationOTP（type=sign-in；变量：otp）。
// Requirements: 22.2、22.5。

import {
  EmailLayout,
  ExpiryNote,
  Footnote,
  OtpCode,
  Paragraph,
  Title,
} from "./layout";
import { resolveEmailLocale } from "./locale";

const copy = {
  en: {
    preview: "Your sign-in code",
    title: "Your sign-in code",
    intro: (app: string) =>
      `Enter the code below to sign in to ${app}. Don't share it with anyone.`,
    expiry: "This code will expire in 5 minutes.",
    footer: "If you didn't try to sign in, you can safely ignore this email.",
  },
  zh: {
    preview: "你的登录验证码",
    title: "你的登录验证码",
    intro: (app: string) =>
      `请输入下方验证码以登录 ${app}。请勿将其分享给任何人。`,
    expiry: "此验证码将在 5 分钟后失效。",
    footer: "若你并未尝试登录，可忽略本邮件。",
  },
} as const;

type SignInOtpEmailProps = {
  readonly otp: string;
  readonly locale: string;
  readonly appName?: string;
};

export const SignInOtpEmail = ({
  otp,
  locale,
  appName = "OpenStarter",
}: SignInOtpEmailProps) => {
  const resolved = resolveEmailLocale(locale);
  const c = copy[resolved];

  return (
    <EmailLayout appName={appName} lang={resolved} preview={c.preview}>
      <Title>{c.title}</Title>
      <Paragraph>{c.intro(appName)}</Paragraph>
      <OtpCode code={otp} />
      <ExpiryNote>{c.expiry}</ExpiryNote>
      <Footnote>{c.footer}</Footnote>
    </EmailLayout>
  );
};
