import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/app-shell";
import { getServerSessionFn } from "@/functions/session";

export const Route = createFileRoute("/_app")({
  staleTime: 60 * 1000,
  beforeLoad: async ({ location }) => {
    const session = await getServerSessionFn();
    if (!session.data) {
      throw redirect({ search: { redirect: location.href }, to: "/login" });
    }
    return { session };
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: AppLayout,
});

function AppLayout() {
  return <AppShell />;
}
