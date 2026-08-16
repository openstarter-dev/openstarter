// apps/web/src/routes/_app/settings/danger.tsx
// 危险操作：删除账户。两步确认（输入邮箱确认）+ 二次确认按钮。
import { createFileRoute } from "@tanstack/react-router";
import { DangerPage } from "@/components/app/settings/danger";

export const Route = createFileRoute("/_app/settings/danger")({
  component: DangerPage,
});
