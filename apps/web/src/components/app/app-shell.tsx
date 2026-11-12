import { SidebarInset, SidebarProvider } from "@openstarter/ui-web/components/sidebar";
import { Outlet, useRouteContext } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";

const SIDEBAR_COOKIE_NAME = "sidebar_state";

function readSidebarCookie(): boolean {
  if (typeof document === "undefined") {
    return true;
  }
  return !document.cookie
    .split("; ")
    .some((cookie) => cookie.startsWith(`${SIDEBAR_COOKIE_NAME}=false`));
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { session } = useRouteContext({ from: "/_app" });

  useEffect(() => {
    setSidebarOpen(readSidebarCookie());
  }, []);

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar initialSession={session?.data ?? null} />
      <SidebarInset>
        <AppHeader>{children}</AppHeader>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
