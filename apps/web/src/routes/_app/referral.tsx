import { m } from "@openstarter/i18n-web/messages";
import { createFileRoute } from "@tanstack/react-router";

import { buildPageTitle } from "@/lib/page-head";
import { preloadQueries } from "@/lib/preload";
import { referral } from "@/modules/referral/lib/api";
import { ReferralPage } from "@/modules/referral/components/referral-page";

export const Route = createFileRoute("/_app/referral")({
  loader: preloadQueries(() => [referral.queries.me(), referral.queries.commissions(1)]),
  head: () => buildPageTitle(m["referral_title"]()),
  component: ReferralPage,
});
