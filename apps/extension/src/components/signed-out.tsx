import { i18n } from "#i18n";

import { Button } from "@openstarter/ui-web/components/button";

export function SignedOut(props: { onSignIn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm">{i18n.t("auth.sign_in_prompt")}</p>
      <Button onClick={props.onSignIn} type="button">
        {i18n.t("auth.sign_in")}
      </Button>
    </div>
  );
}
