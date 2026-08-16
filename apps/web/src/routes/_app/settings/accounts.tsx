// apps/web/src/routes/_app/settings/accounts.tsx
// 关联账户：列出已绑定 + 绑定/解绑 Google/GitHub/Apple。
// 实现「禁止解绑最后一个登录方式」守卫。
import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/components/app/settings/accounts";

export const Route = createFileRoute("/_app/settings/accounts")({
  component: AccountsPage,
});
