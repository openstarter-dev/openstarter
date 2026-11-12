import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@/components/app/settings/security";

export const Route = createFileRoute("/_app/settings/security")({
  component: SecurityPage,
});
