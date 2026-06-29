import { Link } from "@tanstack/react-router";

import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserMenu } from "@/components/app/user-menu";
import { BRAND_NAME } from "@/lib/branding";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/dashboard" className="font-semibold">
          {BRAND_NAME}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <SidebarNav />
      </div>
      <div className="border-t p-2">
        <UserMenu />
      </div>
    </aside>
  );
}
