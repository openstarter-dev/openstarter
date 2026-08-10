// Query 工厂：admin 模块（R25/R26 管理后台）
// 数据面经类型化 RPC（`client.api.admin.*`）→ packages/api（requirePermission admin.*）。

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

const PAGE_SIZE = 20;

const queries = {
  config: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.config.$get();
        if (!res.ok) {
          throw new Error("Failed to load settings");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "config"] as const,
    }),
  credits: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.credits.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load credits");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "credits", page] as const,
    }),
  metrics: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.analytics.metrics.$get();
        if (!res.ok) {
          throw new Error("Failed to load metrics");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "metrics"] as const,
    }),
  orders: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.orders.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load orders");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "orders", page] as const,
    }),
  permissions: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.permissions.$get();
        if (!res.ok) {
          throw new Error("Failed to load permissions");
        }
        return (await res.json()).data ?? [];
      },
      queryKey: ["admin", "permissions"] as const,
    }),
  rolePermissions: (roleId: string | null) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.roles[":id"].permissions.$get({
          param: { id: roleId ?? "" },
        });
        if (!res.ok) {
          throw new Error("Failed to load role permissions");
        }
        return (await res.json()).data ?? [];
      },
      queryKey: ["admin", "roles", roleId, "permissions"] as const,
    }),
  roles: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.roles.$get();
        if (!res.ok) {
          throw new Error("Failed to load roles");
        }
        return (await res.json()).data ?? [];
      },
      queryKey: ["admin", "roles"] as const,
    }),
  subscriptions: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.subscriptions.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load subscriptions");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "subscriptions", page] as const,
    }),
  users: (page: number, search: string) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.users.$get({
          query: {
            page: String(page),
            pageSize: String(PAGE_SIZE),
            ...(search ? { search } : {}),
          },
        });
        if (!res.ok) {
          throw new Error("Failed to load users");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "users", page, search] as const,
    }),
};

const mutations = {
  deleteRole: () =>
    mutationOptions({
      mutationFn: async (id: string) => {
        const res = await client.api.admin.roles[":id"].$delete({
          param: { id },
        });
        if (!res.ok) {
          throw new Error("Failed to delete role");
        }
      },
    }),
  saveConfig: () =>
    mutationOptions({
      mutationFn: async (payload: Record<string, string>) => {
        const res = await client.api.admin.config.$post({ json: payload });
        if (!res.ok) {
          const text = await res.json().catch(() => null);
          const message =
            (text as { error?: string } | null)?.error ?? "Failed to save";
          throw new Error(message);
        }
      },
    }),
  saveRole: () =>
    mutationOptions({
      mutationFn: async (input: {
        id: string | null;
        name: string;
        title: string;
      }) => {
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
    }),
  saveRolePermissions: () =>
    mutationOptions({
      mutationFn: async (input: { id: string; permissionIds: string[] }) => {
        const res = await client.api.admin.roles[":id"].permissions.$put({
          json: { permissionIds: input.permissionIds },
          param: { id: input.id },
        });
        if (!res.ok) {
          throw new Error("Failed to save permissions");
        }
      },
    }),
};

export const admin = { mutations, queries } as const;
