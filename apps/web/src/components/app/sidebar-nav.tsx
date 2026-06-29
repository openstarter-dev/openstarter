import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  to: "/dashboard" | "/settings";
  label: string;
  icon: LucideIcon;
};

export const APP_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {APP_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
