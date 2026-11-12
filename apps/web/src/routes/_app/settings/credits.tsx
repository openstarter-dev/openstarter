import { createFileRoute } from "@tanstack/react-router";
import { CreditsPage } from "@/components/app/settings/credits";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/credits")({
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(user.queries.credits()),
  component: CreditsPage,
});
