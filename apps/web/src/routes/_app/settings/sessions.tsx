// apps/web/src/routes/_app/settings/sessions.tsx
// 会话列表：当前设备高亮 + 单个登出 + 登出其它全部。
import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "@/components/app/settings/sessions";

export const Route = createFileRoute("/_app/settings/sessions")({
  component: SessionsPage,
});
