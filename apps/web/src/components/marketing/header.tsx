import { Button } from "@openstarter/ui/components/button";
import { Skeleton } from "@openstarter/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
            <Menu />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 right-0 flex h-full w-72 flex-col gap-4 bg-background p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{BRAND_NAME}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <nav className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  hash={link.hash}
                  onClick={() => setOpen(false)}
                  className="text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <AuthCta />
          </div>
        </div>
      ) : null}
    </header>
  );
}
