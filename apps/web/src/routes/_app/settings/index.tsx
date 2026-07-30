// apps/web/src/routes/_app/settings/index.tsx
// /settings 顶层重定向到 /settings/profile。

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings/")({
  loader: () => {
    throw redirect({ to: "/settings/profile" });
  },
});
