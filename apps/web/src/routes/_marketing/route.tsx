import { Outlet, createFileRoute, useMatches } from "@tanstack/react-router";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  const isHome = useMatches({
    select: (matches) =>
      matches.some(
        (match) => match.routeId === "/_marketing/" || match.routeId === "/_marketing/design",
      ),
  });
  if (isHome)
    return (
      <main id="main">
        <Outlet />
      </main>
    );
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
