import { createFileRoute } from "@tanstack/react-router";

import { PricingSection } from "@/components/marketing/pricing-section";

export const Route = createFileRoute("/_marketing/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
      <h1 className="font-bold text-4xl tracking-tight">Pricing</h1>
      <p className="mt-3 text-muted-foreground">
        Choose the plan that fits where you are today.
      </p>
      <PricingSection />
    </div>
  );
}
