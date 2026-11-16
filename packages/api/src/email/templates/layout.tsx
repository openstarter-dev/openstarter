import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { styles } from "./styles";

type EmailLayoutProps = {
  readonly lang: string;
  readonly preview: string;
  readonly appName: string;
  readonly children: ReactNode;
};

export const EmailLayout = ({ lang, preview, appName, children }: EmailLayoutProps) => (
  <Html lang={lang}>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Section style={styles.card}>
          <Section style={styles.accentBar} />
          <Text style={styles.brand}>{appName}</Text>
          {children}
        </Section>
      </Container>
    </Body>
  </Html>
);

type TextBlockProps = {
  readonly children: ReactNode;
};

export const Title = ({ children }: TextBlockProps) => (
  <Heading style={styles.heading}>{children}</Heading>
);

export const Paragraph = ({ children }: TextBlockProps) => (
  <Text style={styles.paragraph}>{children}</Text>
);

export const Footnote = ({ children }: TextBlockProps) => (
  <Text style={styles.footer}>{children}</Text>
);

type ActionButtonProps = {
  readonly href: string;
  readonly label: string;
};

export const ActionButton = ({ href, label }: ActionButtonProps) => (
  <Section style={styles.buttonWrap}>
    <Button href={href} style={styles.button}>
      {label}
    </Button>
  </Section>
);

type OtpCodeProps = {
  readonly code: string;
};

export const OtpCode = ({ code }: OtpCodeProps) => (
  <Section style={styles.codeWrap}>
    <Text style={styles.code}>{code}</Text>
  </Section>
);

type ExpiryNoteProps = {
  readonly children: ReactNode;
};

export const ExpiryNote = ({ children }: ExpiryNoteProps) => (
  <Text style={styles.muted}>{children}</Text>
);

type FallbackLinkProps = {
  readonly url: string;
  readonly intro: string;
};

export const FallbackLink = ({ url, intro }: FallbackLinkProps) => (
  <Section>
    <Hr style={styles.divider} />
    <Text style={styles.small}>{intro}</Text>
    <Link href={url} style={styles.link}>
      {url}
    </Link>
  </Section>
);
