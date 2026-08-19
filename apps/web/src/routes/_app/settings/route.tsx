// apps/web/src/routes/_app/settings/route.tsx
// 账户设置外壳：左侧二级导航 + <Outlet/>。
// 子路由：profile / security / accounts / sessions / danger。

import { cn } from "@openstarter/ui-web/lib/utils";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

const NAV_ITEMS = [
  { label: "Profile", to: "/settings/profile" },
  { label: "Billing", to: "/settings/billing" },
  { label: "Credits", to: "/settings/credits" },
  { label: "Payments", to: "/settings/payments" },
  { label: "API keys", to: "/settings/apikeys" },
  { label: "Tickets", to: "/settings/tickets" },
  { label: "Security", to: "/settings/security" },
  { label: "Accounts", to: "/settings/accounts" },
  { label: "Sessions", to: "/settings/sessions" },
  { label: "Danger zone", to: "/settings/danger" },
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
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                key={item.to}
                to={item.to}
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
