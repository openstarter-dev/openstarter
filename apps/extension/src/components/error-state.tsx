import { i18n } from "#i18n";

import { Button } from "@openstarter/ui-web/components/button";

export function ErrorState(props: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-destructive text-sm">{props.message}</p>
      <Button onClick={props.onRetry} type="button" variant="outline">
        {i18n.t("error.retry")}
      </Button>
    </div>
  );
}
