import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import { useRouter } from "@tanstack/react-router";

import { BRAND_NAME } from "@/lib/branding";

export function ErrorPage({ error }: { error: Error }) {
  const isDev = import.meta.env.DEV;
  const router = useRouter();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      <h1 className="font-bold text-2xl">{m["common.error.page_title"]()}</h1>
      <p className="text-muted-foreground text-sm">{m["common.error.page_description"]()}</p>
      {isDev ? (
        <pre className="max-w-full overflow-x-auto rounded bg-muted p-3 text-left text-xs">
          {error.message}
        </pre>
      ) : null}
      <Button
        onClick={() => {
          void router.invalidate();
        }}
        type="button"
      >
        {m["common.error.retry"]()}
      </Button>
    </main>
  );
}
