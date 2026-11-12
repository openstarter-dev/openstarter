import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings/")({
  loader: () => {
    throw redirect({ to: "/settings/profile" });
  },
});
