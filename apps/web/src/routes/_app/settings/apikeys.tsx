import { createFileRoute } from "@tanstack/react-router";
import { ApiKeysPage } from "@/components/app/settings/apikeys";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/apikeys")({
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(user.queries.apiKeys()),
  component: ApiKeysPage,
});
