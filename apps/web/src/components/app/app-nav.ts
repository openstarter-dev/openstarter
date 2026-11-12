import { m } from "@openstarter/i18n-web/messages";
import { LayoutDashboard, Settings, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  to: "/dashboard" | "/settings" | "/referral";
  label: string;
  icon: LucideIcon;
};

// Primary app navigation. The header resolves the current section title from
// this list, so the two stay in sync automatically. Message keys use bracket
// access: the compiled paraglide modules export dotted key names, and in the
// vitest environment only the bracketed name resolves.
export const APP_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: m["common.nav.dashboard"](), icon: LayoutDashboard },
  { to: "/referral", label: m["common.nav.referral"](), icon: Share2 },
  { to: "/settings", label: m["common.nav.settings"](), icon: Settings },
];

export function getAppNavTitle(pathname: string): string | undefined {
  return APP_NAV_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    ?.label;
}
