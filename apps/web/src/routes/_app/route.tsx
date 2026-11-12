import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/app-shell";
import { getServerSessionFn } from "@/functions/session";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app")({
  // 路由 beforeLoad 默认 staleTime=0：父级 match 每次导航都会重跑，等于每次点击
  // 都多打一次 get-session。60s 窗口内复用已校验的会话；过期后后台重校，
  // 配合各请求自身的 401 兜底（登出后从公开页重新进入属于 cause=enter，会强制重跑）。
  staleTime: 60 * 1000,
  beforeLoad: async ({ location }) => {
    // SSR 期间浏览器客户端拿不到会话（相对 URL + 无 cookie），改由 server fn 直连
    // better-auth 并转发请求头；客户端导航仍走浏览器客户端，避免多一次 RPC。
    const session = import.meta.env.SSR
      ? await getServerSessionFn()
      : await authClient.getSession();
    if (!session.data) {
      // 带上原始目标（含查询串），登录成功后回跳；login 侧只接受站内相对路径。
      throw redirect({ search: { redirect: location.href }, to: "/login" });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  return <AppShell />;
}
