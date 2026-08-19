import { Button } from "@openstarter/ui-web/components/button";
import { Link } from "@tanstack/react-router";

import { BRAND_TAGLINE } from "@/lib/branding";

// TODO: replace with your product copy.
const COPY = {
  primaryCta: "Start free trial",
  secondaryCta: "View pricing",
  subtitle:
    "A full-stack TypeScript starter with auth, billing seams, and a polished UI — so you can focus on what makes your product unique.",
  title: BRAND_TAGLINE,
} as const;

export function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="font-bold text-4xl tracking-tight sm:text-5xl">
        Ship your SaaS <span className="text-primary">in days</span>, not months.
      </h1>
      <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{COPY.subtitle}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/login">{COPY.primaryCta}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/pricing">{COPY.secondaryCta}</Link>
        </Button>
      </div>
      <div className="mt-8 w-full rounded-xl border bg-gradient-to-b from-muted/50 to-muted/10 p-2 shadow-sm dark:shadow-[0_0_15px_rgba(110,231,183,0.1)]">
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-card text-muted-foreground text-sm">
          Your product preview goes here
        </div>
      </div>
    </section>
  );
}
