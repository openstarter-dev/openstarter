import { Button } from "@openstarter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { cn } from "@openstarter/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { PRICING_TIERS } from "@/lib/marketing/pricing";

function formatPrice(price: number | "custom"): string {
  if (price === "custom") {
    return "Custom";
  }
  if (price === 0) {
    return "Free";
  }
  return `$${price}/mo`;
}

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          Simple, transparent pricing
        </h2>
        <p className="mt-2 text-muted-foreground">
          Start free. Upgrade when you grow.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const Icon = tier.icon;
          return (
            <Card
              key={tier.id}
              className={cn(tier.highlight && "ring-2 ring-primary")}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon aria-hidden="true" className="size-5 text-primary" />
                  {tier.highlight ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <CardTitle className="mt-2 text-lg">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-2 font-bold text-2xl">
                  {formatPrice(tier.priceMonthly)}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="flex flex-col gap-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check aria-hidden="true" className="size-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              {/* TODO(phase-3): wire CTA to Stripe checkout */}
              <CardFooter>
                <Button
                  className="w-full"
                  variant={tier.highlight ? "default" : "outline"}
                  render={<Link to={tier.cta.to} />}
                >
                  {tier.cta.label}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
