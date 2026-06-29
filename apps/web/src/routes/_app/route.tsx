import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { MobileTopbar } from "@/components/app/mobile-topbar";
import { Sidebar } from "@/components/app/sidebar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
