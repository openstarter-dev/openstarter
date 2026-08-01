// apps/extension/src/components/error-state.tsx —— 网络/服务端错误态（不含 401，见 lib/state.ts）。
import { Button } from "@openstarter/ui-web/components/button";

export function ErrorState(props: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-destructive text-sm">{props.message}</p>
      <Button onClick={props.onRetry} type="button" variant="outline">
        Retry
      </Button>
    </div>
  );
}
