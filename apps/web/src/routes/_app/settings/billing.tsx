import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/app/settings/billing";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/billing")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.prefetchQuery(user.queries.subscription()),
      queryClient.prefetchQuery(user.queries.plan()),
    ]),
  component: BillingPage,
});
