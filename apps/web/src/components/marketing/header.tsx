import { Button } from "@openstarter/ui-web/components/button";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Drawer } from "@/components/drawer";
import { ThemeToggleIcon } from "@/components/theme/theme-toggle-icon";
import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";

const NAV_LINKS = [
  { hash: "features", label: "Features", to: "/" },
  { hash: undefined, label: "Pricing", to: "/pricing" },
  { hash: "faq", label: "FAQ", to: "/" },
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
      <Button render={<Link to="/login" />} variant="ghost">
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
        <Link className="font-semibold" to="/">
          {BRAND_NAME}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              className="text-muted-foreground text-sm hover:text-foreground"
              hash={link.hash}
              key={link.label}
              to={link.to}
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
            aria-expanded={open}
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Menu aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Drawer
        className="gap-4 p-4"
        label="Menu"
        onClose={close}
        open={open}
        side="right"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">{BRAND_NAME}</span>
          <Button
            aria-label="Close menu"
            onClick={close}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <nav className="flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              className="text-sm"
              hash={link.hash}
              key={link.label}
              onClick={close}
              to={link.to}
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
