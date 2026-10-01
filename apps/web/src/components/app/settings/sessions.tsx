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
import { m } from "@/paraglide/messages.js";

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
        toast.error(result.error.message || m["settings.sessions.revoke_failed"]());
        return;
      }
      toast.success(m["settings.sessions.revoke_success"]());
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
        toast.error(result.error.message || m["settings.sessions.revoke_all_failed"]());
        return;
      }
      toast.success(m["settings.sessions.revoke_all_success"]());
      await sessionsQuery.refetch();
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["settings.sessions.title"]()}</CardTitle>
        <CardDescription>{m["settings.sessions.description"]()}</CardDescription>
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
            {revokingOthers
              ? m["settings.sessions.revoking_all"]()
              : m["settings.sessions.revoke_all"]()}
          </Button>
        )}

        {sessionsQuery.isPending ? (
          <p className="text-muted-foreground text-sm">{m["settings.sessions.loading"]()}</p>
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
                    {session.userAgent?.split("/").at(0)?.trim() ||
                      m["settings.sessions.unknown_device"]()}
                    {isCurrent && (
                      <span className="ml-2 text-primary text-xs">
                        {m["settings.sessions.current"]()}
                      </span>
                    )}
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
                  title={isCurrent ? m["settings.sessions.cannot_revoke_current"]() : undefined}
                  type="button"
                  variant="ghost"
                >
                  {revokingToken === session.token
                    ? m["settings.sessions.revoking"]()
                    : m["settings.sessions.revoke"]()}
                </Button>
              </div>
            );
          })}
        </div>

        {sessions.length === 0 && !sessionsQuery.isPending && (
          <p className="text-muted-foreground text-sm">{m["settings.sessions.no_sessions"]()}</p>
        )}
      </CardContent>
    </Card>
  );
}
