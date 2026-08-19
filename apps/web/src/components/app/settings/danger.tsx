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
        toast.error(result.error.message || "Failed to delete account");
        return;
      }
      toast.success(result.data?.message || "Verification email sent");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action is irreversible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-destructive/5 p-4 text-sm">
          <p className="font-medium">This will remove:</p>
          <ul className="ml-4 list-disc text-muted-foreground">
            <li>Your profile, settings, and preferences</li>
            <li>Owned organizations (unless transferred)</li>
            <li>Active sessions and access tokens</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-email">
            Type your email <span className="text-destructive">{userEmail}</span> to confirm
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
          {deleting ? "Deleting..." : "Delete my account"}
        </Button>
      </CardContent>
    </Card>
  );
}
