import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

// TODO: replace with your product features.
const FEATURES: Feature[] = [
  {
    icon: Zap,
    title: "Type-safe end to end",
    description:
      "From database to UI with Drizzle, Hono RPC, and TanStack - no codegen drift.",
  },
  {
    icon: ShieldCheck,
    title: "Auth out of the box",
    description:
      "Email and password sessions wired with Better-Auth, ready for OAuth.",
  },
  {
    icon: Sparkles,
    title: "Stripe-ready",
    description:
      "A pricing page and billing seams designed to plug into Stripe fast.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          Everything you need to ship
        </h2>
        <p className="mt-2 text-muted-foreground">
          Batteries included, opinions optional.
        </p>
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
