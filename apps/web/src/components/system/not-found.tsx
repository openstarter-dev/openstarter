import { Button } from "@openstarter/ui/components/button";
import { Link } from "@tanstack/react-router";

import { BRAND_NAME } from "@/lib/branding";

export function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      <h1 className="font-bold text-2xl">404 — page not found</h1>
      <p className="text-muted-foreground text-sm">
        The page you are looking for does not exist or was moved.
      </p>
      <Button render={<Link to="/" />}>Back home</Button>
    </main>
  );
}
