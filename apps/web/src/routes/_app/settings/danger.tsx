import { createFileRoute } from "@tanstack/react-router";
import { DangerPage } from "@/components/app/settings/danger";

export const Route = createFileRoute("/_app/settings/danger")({
  component: DangerPage,
});
