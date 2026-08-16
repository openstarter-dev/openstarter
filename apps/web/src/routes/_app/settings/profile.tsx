// apps/web/src/routes/_app/settings/profile.tsx
// 编辑用户昵称（头像延后到后续阶段，留 TODO 注释）。
import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/app/settings/profile";

export const Route = createFileRoute("/_app/settings/profile")({
  component: ProfilePage,
});
