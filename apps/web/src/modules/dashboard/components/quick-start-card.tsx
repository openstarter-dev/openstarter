import { m } from "@openstarter/i18n-web/messages";
import { buttonVariants } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { Link } from "@tanstack/react-router";
import { ChevronRight, KeyRound, Settings, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickLink {
  href: "/settings" | "/settings/apikeys" | "/pricing";
  icon: LucideIcon;
  label: string;
}

const QUICK_LINKS: readonly QuickLink[] = [
  { href: "/settings", icon: Settings, label: m["dashboard.quick_start.settings"]() },
  { href: "/pricing", icon: Sparkles, label: m["dashboard.quick_start.pricing"]() },
  { href: "/settings/apikeys", icon: KeyRound, label: m["dashboard.quick_start.apikeys"]() },
];

export function QuickStartCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["dashboard.quick_start.title"]()}</CardTitle>
        <CardDescription>{m["dashboard.quick_start.description"]()}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  className={`${buttonVariants({ variant: "ghost" })} w-full justify-between px-3`}
                  to={link.href}
                >
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                    {link.label}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
