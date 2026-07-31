// apps/web/src/routes/admin/roles.tsx
// 角色管理（R26.2/R26.3）：列出/创建/编辑/删除角色，并覆盖式设置角色权限集合。
// 数据经 /api/admin/roles* 与 /api/admin/permissions（requirePermission admin.*）。

import { Button } from "@openstarter/ui/components/button";
import { Checkbox } from "@openstarter/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstarter/ui/components/dialog";
import { Input } from "@openstarter/ui/components/input";
import { Label } from "@openstarter/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminHeader, StatusText } from "@/components/admin/list";
import { client } from "@/lib/api";

export const Route = createFileRoute("/admin/roles")({
  component: AdminRolesPage,
});

const ROLES_KEY = ["admin", "roles"] as const;
const PERMISSIONS_KEY = ["admin", "permissions"] as const;

interface RoleForm {
  id: string | null;
  name: string;
  title: string;
}

const EMPTY_FORM: RoleForm = { id: null, name: "", title: "" };

function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RoleForm | null>(null);
  const [permRoleId, setPermRoleId] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const rolesQuery = useQuery({
    queryFn: async () => {
      const res = await client.api.admin.roles.$get();
      if (!res.ok) {
        throw new Error("Failed to load roles");
      }
      return (await res.json()).data ?? [];
    },
    queryKey: ROLES_KEY,
  });

  const permissionsQuery = useQuery({
    queryFn: async () => {
      const res = await client.api.admin.permissions.$get();
      if (!res.ok) {
        throw new Error("Failed to load permissions");
      }
      return (await res.json()).data ?? [];
    },
    queryKey: PERMISSIONS_KEY,
  });

  const rolePermsQuery = useQuery({
    enabled: permRoleId !== null,
    queryFn: async () => {
      const res = await client.api.admin.roles[":id"].permissions.$get({
        param: { id: permRoleId ?? "" },
      });
      if (!res.ok) {
        throw new Error("Failed to load role permissions");
      }
      return (await res.json()).data ?? [];
    },
    queryKey: ["admin", "roles", permRoleId, "permissions"],
  });

  useEffect(() => {
    if (rolePermsQuery.data) {
      setSelectedPerms(new Set(rolePermsQuery.data.map((p) => p.permissionId)));
    }
  }, [rolePermsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (input: RoleForm) => {
      if (input.id) {
        const res = await client.api.admin.roles[":id"].$put({
          json: { name: input.name, title: input.title },
          param: { id: input.id },
        });
        if (!res.ok) {
          throw new Error("Failed to update role");
        }
        return;
      }
      const res = await client.api.admin.roles.$post({
        json: { name: input.name, title: input.title },
      });
      if (!res.ok) {
        throw new Error("Failed to create role");
      }
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      toast.success("Role saved");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.admin.roles[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete role");
      }
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      toast.success("Role deleted");
    },
  });

  const savePermsMutation = useMutation({
    mutationFn: async (input: { id: string; permissionIds: string[] }) => {
      const res = await client.api.admin.roles[":id"].permissions.$put({
        json: { permissionIds: input.permissionIds },
        param: { id: input.id },
      });
      if (!res.ok) {
        throw new Error("Failed to save permissions");
      }
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      setPermRoleId(null);
      toast.success("Permissions updated");
    },
  });

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  const togglePerm = (id: string, checked: boolean) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  return (
    <div>
      <AdminHeader
        action={
          <Button onClick={() => setForm(EMPTY_FORM)} size="sm" type="button">
            New role
          </Button>
        }
        description="Roles group permissions and are assigned to users."
        title="Roles"
      />

      <StatusText
        empty={roles.length === 0}
        emptyLabel="No roles yet."
        error={rolesQuery.error as Error | null}
        loading={rolesQuery.isPending}
      />

      {roles.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-mono text-sm">
                    {role.name}
                  </TableCell>
                  <TableCell>{role.title}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      onClick={() => setPermRoleId(role.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Permissions
                    </Button>
                    <Button
                      onClick={() =>
                        setForm({
                          id: role.id,
                          name: role.name,
                          title: role.title,
                        })
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => deleteMutation.mutate(role.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setForm(null);
          }
        }}
        open={form !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit role" : "New role"}</DialogTitle>
            <DialogDescription>
              Use a machine name (e.g. admin) and a human-readable title.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Name</Label>
                <Input
                  id="role-name"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="admin"
                  value={form.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-title">Title</Label>
                <Input
                  id="role-title"
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Administrator"
                  value={form.title}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              disabled={
                !form ||
                form.name.trim().length === 0 ||
                form.title.trim().length === 0 ||
                saveMutation.isPending
              }
              onClick={() => {
                if (form) {
                  saveMutation.mutate({
                    id: form.id,
                    name: form.name.trim(),
                    title: form.title.trim(),
                  });
                }
              }}
              type="button"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPermRoleId(null);
          }
        }}
        open={permRoleId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Role permissions</DialogTitle>
            <DialogDescription>
              Select the permissions granted by this role.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {permissions.map((permission) => (
              <label
                className="flex items-center gap-2 text-sm"
                htmlFor={`perm-${permission.id}`}
                key={permission.id}
              >
                <Checkbox
                  checked={selectedPerms.has(permission.id)}
                  id={`perm-${permission.id}`}
                  onCheckedChange={(checked) =>
                    togglePerm(permission.id, checked === true)
                  }
                />
                <span className="font-mono">{permission.code}</span>
                <span className="text-muted-foreground">
                  {permission.title}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={savePermsMutation.isPending}
              onClick={() => {
                if (permRoleId) {
                  savePermsMutation.mutate({
                    id: permRoleId,
                    permissionIds: [...selectedPerms],
                  });
                }
              }}
              type="button"
            >
              {savePermsMutation.isPending ? "Saving..." : "Save permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
