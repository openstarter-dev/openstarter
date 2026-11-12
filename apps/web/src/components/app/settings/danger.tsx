import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { m } from "@openstarter/i18n-web/messages";

export function DangerPage() {
  const { data: session } = authClient.useSession();
  const userEmail = session?.user?.email ?? "";

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canSubmit =
    userEmail !== "" && confirmText.trim().toLowerCase() === userEmail.toLowerCase();

  const handleDelete = async () => {
    if (!canSubmit) {
      return;
    }
    setDeleting(true);
    try {
      const result = await authClient.deleteUser({
        callbackURL: "/login",
      });
      if (result.error) {
        toast.error(result.error.message || m["settings.danger.delete_failed"]());
        return;
      }
      toast.success(result.data?.message || m["settings.danger.verification_sent"]());
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">{m["settings.danger.title"]()}</CardTitle>
        <CardDescription>{m["settings.danger.description"]()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-destructive/5 p-4 text-sm">
          <p className="font-medium">{m["settings.danger.will_remove"]()}</p>
          <ul className="ml-4 list-disc text-muted-foreground">
            <li>{m["settings.danger.remove_profile"]()}</li>
            <li>{m["settings.danger.remove_organizations"]()}</li>
            <li>{m["settings.danger.remove_sessions"]()}</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-email">
            {m["settings.danger.confirm_label"]({ email: userEmail })}
          </Label>
          <Input
            disabled={deleting}
            id="confirm-email"
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={userEmail}
            type="email"
            value={confirmText}
          />
        </div>

        <Button
          disabled={!canSubmit || deleting}
          onClick={() => {
            handleDelete().catch(() => undefined);
          }}
          type="button"
          variant="destructive"
        >
          {deleting ? m["settings.danger.deleting"]() : m["settings.danger.delete_button"]()}
        </Button>
      </CardContent>
    </Card>
  );
}
