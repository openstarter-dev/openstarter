import { Button } from "@openstarter/ui-web/components/button";

import { BRAND_NAME } from "@/lib/branding";

export function ErrorPage({ error }: { error: Error }) {
  const isDev = import.meta.env.DEV;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      <h1 className="font-bold text-2xl">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        An unexpected error occurred. Please try again.
      </p>
      {isDev ? (
        <pre className="max-w-full overflow-x-auto rounded bg-muted p-3 text-left text-xs">
          {error.message}
        </pre>
      ) : null}
      <Button onClick={() => window.location.reload()} type="button">
        Reload
      </Button>
    </main>
  );
}
