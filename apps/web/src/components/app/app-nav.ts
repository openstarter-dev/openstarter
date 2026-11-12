import { m } from "@openstarter/i18n-web/messages";
import { LayoutDashboard, Settings, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  to: "/dashboard" | "/settings" | "/referral";
  /** 惰性求值：模块顶层调用 m[...]() 会把首次 SSR 请求的 locale 冻结在模块作用域。 */
  label: () => string;
  icon: LucideIcon;
};

export const APP_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: () => m["common.nav.dashboard"](), icon: LayoutDashboard },
  { to: "/referral", label: () => m["common.nav.referral"](), icon: Share2 },
  { to: "/settings", label: () => m["common.nav.settings"](), icon: Settings },
];

export function getAppNavTitle(pathname: string): string | undefined {
  const active = APP_NAV_ITEMS.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  return active?.label();
}
