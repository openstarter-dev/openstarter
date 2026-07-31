// apps/web/src/routes/admin/route.tsx
// 管理后台外壳（Admin_Console，R26）：登录 + 平台级 RBAC 守卫、分组侧边导航（按权限过滤）。
//
// 守卫（R26.1）：beforeLoad 先校验登录（无会话跳 /login），再拉取当前用户权限码集合
// （GET /api/user/permissions），若不具备任何后台入口对应权限则拒绝访问并重定向。
// 菜单过滤（R26.4）：仅展示当前权限码（含通配符）可访问的入口，权限码经 matchPermission 判定。
// 平台级授权仅依通配符 RBAC，与 organization 解耦。ssr:false 对齐 _app（认证态在客户端解析）。

import { cn } from "@openstarter/ui-web/lib/utils";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";

import { client } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { matchAnyPermission, matchPermission } from "@/lib/permissions";

type AdminPath =
  | "/admin"
  | "/admin/users"
  | "/admin/roles"
  | "/admin/orders"
  | "/admin/subscriptions"
  | "/admin/credits"
  | "/admin/settings";

interface AdminNavItem {
  label: string;
  permission: string;
  to: AdminPath;
}

interface AdminNavGroup {
  group: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    group: "Overview",
    items: [{ label: "Dashboard", permission: "admin.*", to: "/admin" }],
  },
  {
    group: "Access control",
    items: [
      { label: "Users", permission: "admin.*", to: "/admin/users" },
      { label: "Roles", permission: "admin.*", to: "/admin/roles" },
      { label: "Settings", permission: "admin.*", to: "/admin/settings" },
    ],
  },
  {
    group: "Billing",
    items: [
      { label: "Orders", permission: "admin.*", to: "/admin/orders" },
      {
        label: "Subscriptions",
        permission: "admin.*",
        to: "/admin/subscriptions",
      },
      { label: "Credits", permission: "admin.*", to: "/admin/credits" },
    ],
  },
];

const ALL_ADMIN_PERMISSIONS = ADMIN_NAV.flatMap((g) =>
  g.items.map((item) => item.permission)
);

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }

    const res = await client.api.user.permissions.$get();
    const permissions = res.ok ? ((await res.json()).data ?? []) : [];

    // 无任何后台入口权限 → 拒绝访问并重定向（R26.1）。
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visibleGroups = ADMIN_NAV.map((group) => ({
    group: group.group,
    items: group.items.filter((item) =>
      matchPermission(item.permission, permissions)
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link className="font-semibold" to="/admin">
            Admin
          </Link>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {visibleGroups.map((group) => (
            <div key={group.group}>
              <p className="px-2 pb-1 font-medium text-muted-foreground text-xs uppercase">
                {group.group}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active =
                    item.to === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.to);
                  return (
                    <Link
                      className={cn(
                        "rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                      key={item.to}
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <Link
            className="text-muted-foreground text-sm hover:text-foreground"
            to="/dashboard"
          >
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
