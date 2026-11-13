import { Building2, Rocket, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PricingCheckout = {
  productId: string;
  amount: number;
  currency: string;
  type: "one-time" | "subscription";
  planName?: string;
  interval?: "day" | "week" | "month" | "year";
  intervalCount?: number;
  credits?: number;
  creditsValidDays?: number;
};

export type PricingCta =
  | { kind: "link"; label: string; to: "/login" }
  | { kind: "checkout"; label: string; checkout: PricingCheckout };

export type PricingTier = {
  id: "starter" | "pro" | "enterprise";
  name: string;
  icon: LucideIcon;
  priceMonthly: number | "custom";
  description: string;
  features: string[];
  cta: PricingCta;
  highlight?: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    icon: Rocket,
    priceMonthly: 0,
    description: "For solo builders shipping their first product.",
    features: ["1 project", "Up to 1K MAU", "Community support"],
    cta: { kind: "link", label: "Get started", to: "/login" },
  },
  {
    id: "pro",
    name: "Pro",
    icon: Sparkles,
    priceMonthly: 29,
    description: "Everything you need to grow a real business.",
    features: ["Unlimited projects", "Up to 50K MAU", "Email support", "Custom domains"],
    cta: {
      kind: "checkout",
      label: "Start free trial",
      checkout: {
        productId: "pro_monthly",
        amount: 2900,
        currency: "usd",
        type: "subscription",
        planName: "Pro",
        interval: "month",
        intervalCount: 1,
        credits: 50_000,
      },
    },
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    priceMonthly: "custom",
    description: "Scale-grade controls and dedicated support.",
    features: ["Unlimited MAU", "SSO / SAML", "Dedicated CSM", "SLA & DPA"],
    cta: { kind: "link", label: "Contact sales", to: "/login" },
  },
];
