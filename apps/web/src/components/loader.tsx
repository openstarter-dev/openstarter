import { Loader2 } from "@openstarter/ui-web/icons";

export default function Loader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="animate-spin" />
    </div>
  );
}
