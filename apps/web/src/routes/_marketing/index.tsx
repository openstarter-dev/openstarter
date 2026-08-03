import { createFileRoute } from "@tanstack/react-router";

import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { PricingSection } from "@/components/marketing/pricing-section";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/branding";
import { buildPageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_marketing/")({
  head: () =>
    buildPageHead({
      title: BRAND_NAME,
      description: BRAND_TAGLINE,
      path: "/",
    }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <PricingSection />
      <Faq />
    </>
  );
}
