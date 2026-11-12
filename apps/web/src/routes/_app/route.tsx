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
  // 登录后页面不参与索引（含未单独声明 head 的子页）。
  head: () => ({ meta: [{ content: "noindex, nofollow", name: "robots" }] }),
  component: AppLayout,
});

function AppLayout() {
  return <AppShell />;
}
