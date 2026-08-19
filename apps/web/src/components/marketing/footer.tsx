import { Link } from "@tanstack/react-router";
import { Github, MessageCircle, Twitter } from "lucide-react";

import { BRAND_NAME, BRAND_TAGLINE, COPYRIGHT_YEAR_START, SOCIAL_LINKS } from "@/lib/branding";

const PRODUCT_LINKS = [
  { label: "Features", to: "/", hash: "features" },
  { label: "Pricing", to: "/pricing", hash: undefined },
  { label: "FAQ", to: "/", hash: "faq" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
] as const;

function copyrightLabel(): string {
  const now = new Date().getFullYear();
  return now > COPYRIGHT_YEAR_START ? `${COPYRIGHT_YEAR_START}-${now}` : `${now}`;
}

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <span className="font-semibold">{BRAND_NAME}</span>
          <p className="text-muted-foreground text-sm">{BRAND_TAGLINE}</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Product</span>
          {PRODUCT_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              hash={link.hash}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Legal</span>
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Connect</span>
          <div className="flex gap-3">
            <a
              href={SOCIAL_LINKS.github}
              aria-label="GitHub"
              target="_blank"
              rel="noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              <Github aria-hidden="true" className="size-5" />
            </a>
            <a
              href={SOCIAL_LINKS.x}
              aria-label="X"
              target="_blank"
              rel="noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              <Twitter aria-hidden="true" className="size-5" />
            </a>
            <a
              href={SOCIAL_LINKS.discord}
              aria-label="Discord"
              target="_blank"
              rel="noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              <MessageCircle aria-hidden="true" className="size-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t py-6 text-center text-muted-foreground text-xs">
        (c) {copyrightLabel()} {BRAND_NAME}
      </div>
    </footer>
  );
}
