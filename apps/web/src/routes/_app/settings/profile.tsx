import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/app/settings/profile";

export const Route = createFileRoute("/_app/settings/profile")({
  component: ProfilePage,
});
