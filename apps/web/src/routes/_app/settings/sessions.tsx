// apps/web/src/routes/_app/settings/sessions.tsx
// 会话列表：当前设备高亮 + 单个登出 + 登出其它全部。

import { Button } from "@openstarter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app/settings/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const { data: sessionsData, refetch: refetchSessions } =
    authClient.useListSessions();
  const sessions = sessionsData ?? [];

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const result = await authClient.revokeSession({
        id: sessionId,
      });
      if (result.error) {
        toast.error(
          result.error.message || "Failed to revoke session",
        );
        return;
      }
      toast.success("Session revoked");
      refetchSessions();
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) {
        toast.error(
          result.error.message || "Failed to revoke other sessions",
        );
        return;
      }
      toast.success("Other sessions revoked");
      refetchSessions();
    } finally {
      setRevokingOthers(false);
    }
  };

  // 找当前会话（通常为最新创建的）
  const currentSession = sessions[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>
          Manage your active sessions across devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={revokingOthers}
            onClick={() => {
              handleRevokeOthers().catch(() => undefined);
            }}
          >
            {revokingOthers
              ? "Revoking..."
              : "Revoke all other sessions"}
          </Button>
        )}

        <div className="divide-y rounded-lg border">
          {sessions.map((session) => {
            const isCurrent =
              currentSession?.id === session.id;
            return (
              <div
                key={session.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {session.userAgent
                      ?.split("/")[0]
                      ?.trim() ||
                      "Unknown device"}
                    {isCurrent && (
                      <span className="ml-2 text-primary text-xs">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {session.createdAt
                      ? new Date(
                          session.createdAt,
                        ).toLocaleDateString()
                      : ""}
                    {session.ipAddress &&
                      ` · ${session.ipAddress}`}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={
                    revokingId === session.id || isCurrent
                  }
                  onClick={() =>
                    handleRevoke(session.id)
                  }
                  title={
                    isCurrent
                      ? "Cannot revoke current session"
                      : undefined
                  }
                >
                  {revokingId === session.id
                    ? "Revoking..."
                    : "Revoke"}
                </Button>
              </div>
            );
          })}
        </div>

        {sessions.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No active sessions found.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
