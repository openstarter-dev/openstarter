import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "@/components/app/settings/sessions";
import { auth } from "@/modules/auth/lib/api";

export const Route = createFileRoute("/_app/settings/sessions")({
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(auth.queries.sessions()),
  component: SessionsPage,
});
