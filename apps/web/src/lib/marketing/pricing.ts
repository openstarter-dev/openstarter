import { Building2, Rocket, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PricingTier = {
  id: "starter" | "pro" | "enterprise";
  name: string;
  icon: LucideIcon;
  priceMonthly: number | "custom";
  description: string;
  features: string[];
  // Phase 0: all CTAs go to /login. Phase 3 will broaden this to Stripe.
  cta: { label: string; to: "/login" };
  highlight?: boolean;
};

// TODO: replace with your own pricing.
export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    icon: Rocket,
    priceMonthly: 0,
    description: "For solo builders shipping their first product.",
    features: ["1 project", "Up to 1K MAU", "Community support"],
    cta: { label: "Get started", to: "/login" },
  },
  {
    id: "pro",
    name: "Pro",
    icon: Sparkles,
    priceMonthly: 29,
    description: "Everything you need to grow a real business.",
    features: [
      "Unlimited projects",
      "Up to 50K MAU",
      "Email support",
      "Custom domains",
    ],
    cta: { label: "Start free trial", to: "/login" },
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    priceMonthly: "custom",
    description: "Scale-grade controls and dedicated support.",
    features: ["Unlimited MAU", "SSO / SAML", "Dedicated CSM", "SLA & DPA"],
    cta: { label: "Contact sales", to: "/login" },
  },
];
