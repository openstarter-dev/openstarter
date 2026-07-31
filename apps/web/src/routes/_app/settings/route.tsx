// apps/web/src/routes/_app/settings/route.tsx
// 账户设置外壳：左侧二级导航 + <Outlet/>。
// 子路由：profile / security / accounts / sessions / danger。

import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { cn } from "@openstarter/ui/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

const NAV_ITEMS = [
  { to: "/settings/profile", label: "Profile" },
  { to: "/settings/security", label: "Security" },
  { to: "/settings/accounts", label: "Accounts" },
  { to: "/settings/sessions", label: "Sessions" },
  { to: "/settings/danger", label: "Danger zone" },
] as const;

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, security, linked accounts, and sessions.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-48 md:flex-col md:overflow-visible"
        >
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
