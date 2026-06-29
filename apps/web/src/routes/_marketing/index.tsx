import { createFileRoute } from "@tanstack/react-router";

import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { PricingSection } from "@/components/marketing/pricing-section";

export const Route = createFileRoute("/_marketing/")({
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
