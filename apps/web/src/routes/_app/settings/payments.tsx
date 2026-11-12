import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/components/app/settings/payments";
import { listSearchParams } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/payments")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [user.queries.orders(Number(deps.page) || 1)]),
  component: PaymentsRoute,
});

function PaymentsRoute() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <PaymentsPage
      onPageChange={(next) => {
        void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
      }}
      page={page}
    />
  );
}
