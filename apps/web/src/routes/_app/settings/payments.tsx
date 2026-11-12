import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/components/app/settings/payments";
import { type ListSearch, listSearchParams } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/payments")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps: ListSearch) => [user.queries.orders(deps.page)]),
  component: PaymentsRoute,
});

function PaymentsRoute() {
  const { page } = Route.useSearch();

  return <PaymentsPage page={page} to="/settings/payments" />;
}
