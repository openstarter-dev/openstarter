import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { auth } from "@/modules/auth/lib/api";

export function SessionsPage() {
  const { data: currentSessionData, isPending: isCurrentSessionPending } = authClient.useSession();
  const sessionsQuery = useQuery({ ...auth.queries.sessions() });
  const sessions = sessionsQuery.data ?? [];
  const currentSessionToken = currentSessionData?.session.token;
  const canRevokeSession = !isCurrentSessionPending && currentSessionToken !== undefined;

  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const handleRevoke = async (token: string) => {
    if (!canRevokeSession || token === currentSessionToken) {
      return;
    }
    setRevokingToken(token);
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) {
        toast.error(result.error.message || "Failed to revoke session");
        return;
      }
      toast.success("Session revoked");
      await sessionsQuery.refetch();
    } finally {
      setRevokingToken(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) {
        toast.error(result.error.message || "Failed to revoke other sessions");
        return;
      }
      toast.success("Other sessions revoked");
      await sessionsQuery.refetch();
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>Manage your active sessions across devices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length > 1 && (
          <Button
            disabled={revokingOthers}
            onClick={() => {
              handleRevokeOthers().catch((error: Error) => {
                toast.error(error.message);
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {revokingOthers ? "Revoking..." : "Revoke all other sessions"}
          </Button>
        )}

        {sessionsQuery.isPending ? (
          <p className="text-muted-foreground text-sm">Loading sessions...</p>
        ) : null}
        {sessionsQuery.error ? (
          <p className="text-destructive text-sm">{sessionsQuery.error.message}</p>
        ) : null}
        <div className="divide-y rounded-lg border">
          {sessions.map((session) => {
            const isCurrent = currentSessionToken === session.token;
            return (
              <div className="flex items-center justify-between px-4 py-3" key={session.id}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">
                    {session.userAgent?.split("/").at(0)?.trim() || "Unknown device"}
                    {isCurrent && <span className="ml-2 text-primary text-xs">Current</span>}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : ""}
                    {session.ipAddress ? ` · ${session.ipAddress}` : null}
                  </span>
                </div>
                <Button
                  disabled={!canRevokeSession || revokingToken === session.token || isCurrent}
                  onClick={() => {
                    handleRevoke(session.token).catch((error: Error) => {
                      toast.error(error.message);
                    });
                  }}
                  size="sm"
                  title={isCurrent ? "Cannot revoke current session" : undefined}
                  type="button"
                  variant="ghost"
                >
                  {revokingToken === session.token ? "Revoking..." : "Revoke"}
                </Button>
              </div>
            );
          })}
        </div>

        {sessions.length === 0 && !sessionsQuery.isPending && (
          <p className="text-muted-foreground text-sm">No active sessions found.</p>
        )}
      </CardContent>
    </Card>
  );
}
