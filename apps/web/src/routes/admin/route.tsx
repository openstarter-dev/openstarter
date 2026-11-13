import { m } from "@openstarter/i18n-web/messages";
import { cn } from "@openstarter/ui-web/lib/utils";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

import { getServerSessionFn } from "@/functions/session";
import { authClient } from "@/lib/auth-client";
import { buildPageTitle } from "@/lib/page-head";

type AdminPath =
  | "/admin"
  | "/admin/users"
  | "/admin/ai-models"
  | "/admin/orders"
  | "/admin/subscriptions"
  | "/admin/credits"
  | "/admin/settings";

interface AdminNavItem {
  label: () => string;
  to: AdminPath;
}

interface AdminNavGroup {
  group: () => string;
  items: AdminNavItem[];
}

/** 后台入口的权限请求：`admin` 资源的 `*` 动作（定义见 packages/auth/src/rbac/access.ts）。 */
const ADMIN_ACCESS: { admin: "*"[] } = { admin: ["*"] };

/** 代码内定义的角色（与 rbac/access.ts 的 PlatformRole 一致）。 */
const KNOWN_ROLES = ["admin", "user"] as const;

type KnownRole = (typeof KNOWN_ROLES)[number];

const parseKnownRoles = (role: string | null | undefined): KnownRole[] =>
  (role ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name): name is KnownRole => (KNOWN_ROLES as readonly string[]).includes(name));

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    group: () => m["admin.nav.overview"](),
    items: [{ label: () => m["admin.nav.dashboard"](), to: "/admin" }],
  },
  {
    group: () => m["admin.nav.access_control"](),
    items: [
      { label: () => m["admin.nav.users"](), to: "/admin/users" },
      { label: () => m["admin.nav.ai_models"](), to: "/admin/ai-models" },
      { label: () => m["admin.nav.settings"](), to: "/admin/settings" },
    ],
  },
  {
    group: () => m["admin.nav.billing"](),
    items: [
      { label: () => m["admin.nav.orders"](), to: "/admin/orders" },
      { label: () => m["admin.nav.subscriptions"](), to: "/admin/subscriptions" },
      { label: () => m["admin.nav.credits"](), to: "/admin/credits" },
    ],
  },
];

export const Route = createFileRoute("/admin")({
  staleTime: 60 * 1000,
  head: () => ({
    meta: [
      { content: "noindex, nofollow", name: "robots" },
      ...buildPageTitle(m["common.systems.admin"]()).meta,
    ],
  }),
  beforeLoad: async ({ location }) => {
    const session = await getServerSessionFn();

    if (!session.data) {
      throw redirect({ search: { redirect: location.href }, to: "/login" });
    }

    // 判定交给 better-auth：与服务端 `userHasPermission` 共用同一组 ac/roles。
    // 会话对象在运行时带 `role`（user 表整行），但插件的 Session 推导未包含该字段。
    const { role } = session.data.user as { role?: string | null };
    const allowed = parseKnownRoles(role).some((name) =>
      authClient.admin.checkRolePermission({ permissions: ADMIN_ACCESS, role: name }),
    );

    if (!allowed) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
  ssr: false,
});

function AdminLayout() {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link className="font-semibold" to="/admin">
            {m["common.systems.admin"]()}
          </Link>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {ADMIN_NAV.map((group) => (
            <div key={group.group()}>
              <p className="px-2 pb-1 font-medium text-muted-foreground text-xs uppercase">
                {group.group()}
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
