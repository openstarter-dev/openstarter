// apps/extension/src/components/signed-out.tsx —— 未登录态：引导去 web 端登录。
// 插件内不放登录表单（见 spec §2 登录体验决策）。
import { Button } from "@openstarter/ui-web/components/button";

export function SignedOut(props: { onSignIn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm">
        Sign in to the OpenStarter web app to see your account here.
      </p>
      <Button onClick={props.onSignIn} type="button">
        Sign in
      </Button>
    </div>
  );
}
