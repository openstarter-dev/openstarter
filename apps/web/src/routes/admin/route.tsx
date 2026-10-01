// apps/web/src/routes/admin/route.tsx
// 管理后台外壳（Admin_Console，R26）：登录 + 平台级 RBAC 守卫、分组侧边导航（按权限过滤）。

import { cn } from "@openstarter/ui-web/lib/utils";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { matchAnyPermission, matchPermission } from "@/lib/permissions";
import { m } from "@/paraglide/messages.js";
import { user } from "@/modules/user/lib/api";

type AdminPath =
  | "/admin"
  | "/admin/users"
  | "/admin/roles"
  | "/admin/ai-models"
  | "/admin/orders"
  | "/admin/subscriptions"
  | "/admin/credits"
  | "/admin/settings";

interface AdminNavItem {
  label: () => string;
  permission: string;
  to: AdminPath;
}

interface AdminNavGroup {
  group: () => string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    group: () => m["admin.nav.overview"](),
    items: [{ label: () => m["admin.nav.dashboard"](), permission: "admin.*", to: "/admin" }],
  },
  {
    group: () => m["admin.nav.access_control"](),
    items: [
      { label: () => m["admin.nav.users"](), permission: "admin.*", to: "/admin/users" },
      { label: () => m["admin.nav.roles"](), permission: "admin.*", to: "/admin/roles" },
      { label: () => m["admin.nav.ai_models"](), permission: "admin.*", to: "/admin/ai-models" },
      { label: () => m["admin.nav.settings"](), permission: "admin.*", to: "/admin/settings" },
    ],
  },
  {
    group: () => m["admin.nav.billing"](),
    items: [
      { label: () => m["admin.nav.orders"](), permission: "admin.*", to: "/admin/orders" },
      {
        label: () => m["admin.nav.subscriptions"](),
        permission: "admin.*",
        to: "/admin/subscriptions",
      },
      { label: () => m["admin.nav.credits"](), permission: "admin.*", to: "/admin/credits" },
    ],
  },
];

const ALL_ADMIN_PERMISSIONS = ADMIN_NAV.flatMap((g) => g.items.map((item) => item.permission));

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const [session, permissions] = await Promise.all([
      authClient.getSession(),
      queryClient.ensureQueryData(user.queries.permissions()).catch(() => [] as string[]),
    ]);

    if (!session.data) {
      throw redirect({ to: "/login" });
    }

    if (!matchAnyPermission(ALL_ADMIN_PERMISSIONS, permissions)) {
      throw redirect({ to: "/dashboard" });
    }

    return { permissions };
  },
  component: AdminLayout,
  ssr: false,
});

function AdminLayout() {
  const { permissions } = Route.useRouteContext();

  const visibleGroups = ADMIN_NAV.map((group) => ({
    group: group.group(),
    items: group.items.filter((item) => matchPermission(item.permission, permissions)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link className="font-semibold" to="/admin">
            {m["common.systems.admin"]()}
          </Link>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {visibleGroups.map((group) => (
            <div key={group.group}>
              <p className="px-2 pb-1 font-medium text-muted-foreground text-xs uppercase">
                {group.group}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <Link
                    activeOptions={{ exact: item.to === "/admin" }}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-sm transition-colors",
                      "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      "data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground",
                    )}
                    key={item.to}
                    to={item.to}
                  >
                    {item.label()}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <Link className="text-muted-foreground text-sm hover:text-foreground" to="/dashboard">
            {m["common.back_to_app"]()}
          </Link>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
