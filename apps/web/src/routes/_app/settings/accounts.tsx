import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/components/app/settings/accounts";
import { auth } from "@/modules/auth/lib/api";

export const Route = createFileRoute("/_app/settings/accounts")({
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(auth.queries.accounts()),
  component: AccountsPage,
});
