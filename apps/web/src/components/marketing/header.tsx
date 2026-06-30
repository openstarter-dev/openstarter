import { Button } from "@openstarter/ui/components/button";
import { Skeleton } from "@openstarter/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Drawer } from "@/components/drawer";
import { ThemeToggleIcon } from "@/components/theme/theme-toggle-icon";
import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";

const NAV_LINKS = [
  { label: "Features", to: "/", hash: "features" },
  { label: "Pricing", to: "/pricing", hash: undefined },
  { label: "FAQ", to: "/", hash: "faq" },
] as const;

function AuthCta() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-8 w-32" />;
  }
  if (session) {
    return <Button render={<Link to="/dashboard" />}>Go to dashboard</Button>;
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" render={<Link to="/login" />}>
        Sign in
      </Button>
      <Button render={<Link to="/login" />}>Sign up</Button>
    </div>
  );
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="font-semibold">
          {BRAND_NAME}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              hash={link.hash}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggleIcon />
          <AuthCta />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggleIcon />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Drawer
        open={open}
        onClose={close}
        side="right"
        label="Menu"
        className="gap-4 p-4"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">{BRAND_NAME}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={close}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <nav className="flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              hash={link.hash}
              onClick={close}
              className="text-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <AuthCta />
      </Drawer>
    </header>
  );
}
