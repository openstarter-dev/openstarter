import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstarter/ui-web/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstarter/ui-web/components/dropdown-menu";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { NativeSelect, NativeSelectOption } from "@openstarter/ui-web/components/native-select";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { adminKeys } from "@/modules/admin/lib/api";
import { authClient } from "@/lib/auth-client";

/** 代码内定义的角色（与 packages/auth/src/rbac/permissions.ts 保持一致）。 */
const ROLE_OPTIONS = ["admin", "user"] as const;

type RoleOption = (typeof ROLE_OPTIONS)[number];

const toRoleOption = (value: string): RoleOption =>
  (ROLE_OPTIONS as readonly string[]).includes(value) ? (value as RoleOption) : "user";

const ROLE_LABELS: Record<(typeof ROLE_OPTIONS)[number], () => string> = {
  admin: () => m["admin.users.role_admin"](),
  user: () => m["admin.users.role_user"](),
};

export interface UserActionsTarget {
  banned?: boolean | null;
  email: string;
  id: string;
  name: string;
  role?: string | null;
}

type Panel = "role" | "ban" | "sessions" | "delete" | null;

interface UserSession {
  createdAt: Date | string;
  id: string;
  token: string;
  userAgent?: string | null;
}

const firstRole = (role: string | null | undefined): RoleOption =>
  toRoleOption((role ?? "").split(",")[0]?.trim() ?? "");

/**
 * 后台用户操作入口：角色、封禁、会话、冒充、删除全部走 better-auth `admin` 插件，
 * 不再自建用户/角色接口。业务字段（积分、订单等）仍由 `/api/admin/*` 提供，二者互不覆盖。
 */
export function UserActions({ user }: { user: UserActionsTarget }) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>(null);
  const [role, setRole] = useState<RoleOption>(firstRole(user.role));
  const [banReason, setBanReason] = useState("");
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [pending, setPending] = useState(false);

  const isBanned = user.banned === true;

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.all });

  const run = async (action: () => Promise<{ error: { message?: string } | null }>) => {
    setPending(true);
    try {
      const { error } = await action();
      if (error) {
        toast.error(error.message ?? m["admin.users.action_failed"]());
        return false;
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m["admin.users.action_failed"]());
      return false;
    } finally {
      setPending(false);
    }
  };

  const handleSaveRole = async () => {
    const ok = await run(() => authClient.admin.setRole({ role, userId: user.id }));
    if (!ok) {
      return;
    }
    toast.success(m["admin.users.role_saved"]());
    setPanel(null);
    await refresh();
  };

  const handleToggleBan = async () => {
    const ok = await run(() =>
      isBanned
        ? authClient.admin.unbanUser({ userId: user.id })
        : authClient.admin.banUser({
            ...(banReason.trim() ? { banReason: banReason.trim() } : {}),
            userId: user.id,
          }),
    );
    if (!ok) {
      return;
    }
    toast.success(m["admin.users.ban_saved"]());
    setPanel(null);
    setBanReason("");
    await refresh();
  };

  const handleLoadSessions = async () => {
    setSessions(null);
    setPanel("sessions");
    await run(async () => {
      const { data, error } = await authClient.admin.listUserSessions({ userId: user.id });
      if (!error) {
        setSessions((data?.sessions ?? []) as UserSession[]);
      }
      return { error };
    });
  };

  const handleRevokeSessions = async () => {
    const ok = await run(() => authClient.admin.revokeUserSessions({ userId: user.id }));
    if (!ok) {
      return;
    }
    setSessions((current) => current ?? []);
    toast.success(m["admin.users.sessions_revoked"]());
  };

  const handleImpersonate = async () => {
    const ok = await run(() => authClient.admin.impersonateUser({ userId: user.id }));
    if (ok) {
      window.location.assign("/dashboard");
    }
  };

  const handleDelete = async () => {
    const ok = await run(() => authClient.admin.removeUser({ userId: user.id }));
    if (!ok) {
      return;
    }
    setPanel(null);
    await refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            {m["admin.users.actions"]()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setPanel("role")}>
            {m["admin.users.role_label"]()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPanel("ban")}>
            {isBanned ? m["admin.users.unban"]() : m["admin.users.ban"]()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleLoadSessions()}>
            {m["admin.users.sessions"]()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleImpersonate()}>
            {m["admin.users.impersonate"]()}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPanel("delete")} variant="destructive">
            {m["admin.users.delete"]()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={panel !== null} onOpenChange={(open) => (open ? undefined : setPanel(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {panel === "role"
                ? m["admin.users.role_label"]()
                : panel === "ban"
                  ? isBanned
                    ? m["admin.users.unban"]()
                    : m["admin.users.ban"]()
                  : panel === "sessions"
                    ? m["admin.users.sessions"]()
                    : m["admin.users.delete"]()}
            </DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>

          {panel === "role" ? (
            <div className="space-y-2">
              <Label htmlFor="admin-user-role">{m["admin.users.role_label"]()}</Label>
              <NativeSelect
                id="admin-user-role"
                onChange={(event) => setRole(toRoleOption(event.target.value))}
                value={role}
              >
                {ROLE_OPTIONS.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {ROLE_LABELS[option]()}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          {panel === "ban" ? (
            isBanned ? (
              <p className="text-muted-foreground text-sm">{m["admin.users.unban_hint"]()}</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="admin-user-ban-reason">{m["admin.users.ban_reason"]()}</Label>
                <Input
                  id="admin-user-ban-reason"
                  onChange={(event) => setBanReason(event.target.value)}
                  value={banReason}
                />
              </div>
            )
          ) : null}

          {panel === "sessions" ? (
            <div className="space-y-3">
              {sessions === null ? (
                <p className="text-muted-foreground text-sm">{m["admin.loading"]()}</p>
              ) : sessions.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {m["admin.users.sessions_empty"]()}
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {sessions.map((session) => (
                    <li className="rounded-md border p-2 text-sm" key={session.id}>
                      <p className="truncate">{session.userAgent ?? m["admin.users.unknown_device"]()}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                disabled={pending || !sessions?.length}
                onClick={() => void handleRevokeSessions()}
                variant="outline"
              >
                {m["admin.users.revoke_all_sessions"]()}
              </Button>
            </div>
          ) : null}

          {panel === "delete" ? (
            <p className="text-muted-foreground text-sm">{m["admin.users.delete_confirm"]()}</p>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setPanel(null)} variant="ghost">
              {m["admin.users.cancel"]()}
            </Button>
            {panel === "role" ? (
              <Button disabled={pending} onClick={() => void handleSaveRole()}>
                {m["admin.users.save"]()}
              </Button>
            ) : null}
            {panel === "ban" ? (
              <Button disabled={pending} onClick={() => void handleToggleBan()}>
                {m["admin.users.save"]()}
              </Button>
            ) : null}
            {panel === "delete" ? (
              <Button disabled={pending} onClick={() => void handleDelete()} variant="destructive">
                {m["admin.users.delete"]()}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
