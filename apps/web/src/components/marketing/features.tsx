import { Card, CardDescription, CardHeader, CardTitle } from "@openstarter/ui-web/components/card";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";

interface Feature {
  description: string;
  icon: LucideIcon;
  title: string;
}

// TODO: replace with your product features.
const FEATURES: Feature[] = [
  {
    description: "From database to UI with Drizzle, Hono RPC, and TanStack - no codegen drift.",
    icon: Zap,
    title: "Type-safe end to end",
  },
  {
    description: "Email and password sessions wired with Better-Auth, ready for OAuth.",
    icon: ShieldCheck,
    title: "Auth out of the box",
  },
  {
    description: "A pricing page and billing seams designed to plug into Stripe fast.",
    icon: Sparkles,
    title: "Stripe-ready",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20" id="features">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">Everything you need to ship</h2>
        <p className="mt-2 text-muted-foreground">Batteries included, opinions optional.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardHeader>
                <Icon aria-hidden="true" className="mb-2 size-6 text-primary" />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
