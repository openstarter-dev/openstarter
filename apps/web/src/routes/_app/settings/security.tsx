// apps/web/src/routes/_app/settings/security.tsx
// 改密码 + 改邮箱两张卡。
import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@/components/app/settings/security";

export const Route = createFileRoute("/_app/settings/security")({
  component: SecurityPage,
});
