import { cn } from "@openstarter/ui-web/lib/utils";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const NAV_ITEMS = [
    { label: m["settings.nav.profile"](), to: "/settings/profile" },
    { label: m["settings.nav.billing"](), to: "/settings/billing" },
    { label: m["settings.nav.credits"](), to: "/settings/credits" },
    { label: m["settings.nav.payments"](), to: "/settings/payments" },
    { label: m["settings.nav.apikeys"](), to: "/settings/apikeys" },
    { label: m["settings.nav.tickets"](), to: "/settings/tickets" },
    { label: m["settings.nav.security"](), to: "/settings/security" },
    { label: m["settings.nav.accounts"](), to: "/settings/accounts" },
    { label: m["settings.nav.sessions"](), to: "/settings/sessions" },
    { label: m["settings.nav.danger"](), to: "/settings/danger" },
  ] as const;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">{m["settings.title"]()}</h1>
        <p className="text-muted-foreground text-sm">{m["settings.layout.description"]()}</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-48 md:flex-col md:overflow-visible"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                "data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground",
              )}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
