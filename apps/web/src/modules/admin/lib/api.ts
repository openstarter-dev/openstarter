import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";

import { assertOk, client, unwrapQuery, withAbort } from "@/lib/api";
import { LIST_PAGE_SIZE } from "@/lib/list-search";

const PAGE_SIZE = LIST_PAGE_SIZE;

/**
 * admin 域 query key 工厂（qk-hierarchical-organization）。
 * 列表增删改后需整表失效，故保留 `all` 前缀；页面与 mutation 都只引用工厂，
 * 不写字面量 key，避免两侧漂移。
 */
export const adminKeys = {
  all: ["admin"] as const,
  aiModels: {
    all: ["admin", "ai-models"] as const,
    page: (page: number) => ["admin", "ai-models", page] as const,
  },
  config: () => ["admin", "config"] as const,
  credits: (page: number) => ["admin", "credits", page] as const,
  metrics: () => ["admin", "metrics"] as const,
  orders: (page: number) => ["admin", "orders", page] as const,
  permissions: () => ["admin", "permissions"] as const,
  roles: {
    all: ["admin", "roles"] as const,
    permissions: (roleId: string | null) => ["admin", "roles", roleId, "permissions"] as const,
  },
  subscriptions: (page: number) => ["admin", "subscriptions", page] as const,
  users: (page: number, search: string) => ["admin", "users", page, search] as const,
} as const;

/** `ai_model` 目录行的媒体类型（与后端 AI_MEDIA_TYPES 一致）。 */
export const AI_MODEL_MEDIA_TYPES = ["text", "image", "video", "music", "speech"] as const;

export type AiModelMediaType = (typeof AI_MODEL_MEDIA_TYPES)[number];

const getAiModels = client.api.admin["ai-models"].$get;
const createAiModel = client.api.admin["ai-models"].$post;
const getAdminConfig = client.api.admin.config.$get;
const getCredits = client.api.admin.credits.$get;
const getMetrics = client.api.admin.analytics.metrics.$get;
const getOrders = client.api.admin.orders.$get;
const getPermissions = client.api.admin.permissions.$get;
const getRolePermissions = client.api.admin.roles[":id"].permissions.$get;
const getRoles = client.api.admin.roles.$get;
const getSubscriptions = client.api.admin.subscriptions.$get;
const getUsers = client.api.admin.users.$get;

type AiModelListData = NonNullable<InferResponseType<typeof getAiModels, 200>["data"]>;
/** admin 模型列表行，直接从 RPC 响应推导。 */
export type AiModelRow = AiModelListData["items"][number];
/** 整页列表形态（乐观更新按 page 改写 items）。 */
export type AiModelList = AiModelListData;

type AdminConfigData = NonNullable<InferResponseType<typeof getAdminConfig, 200>["data"]>;
type CreditListData = NonNullable<InferResponseType<typeof getCredits, 200>["data"]>;
type MetricsData = NonNullable<InferResponseType<typeof getMetrics, 200>["data"]>;
type OrderListData = NonNullable<InferResponseType<typeof getOrders, 200>["data"]>;
type PermissionListData = NonNullable<InferResponseType<typeof getPermissions, 200>["data"]>;
type RolePermissionListData = NonNullable<
  InferResponseType<typeof getRolePermissions, 200>["data"]
>;
type RoleListData = NonNullable<InferResponseType<typeof getRoles, 200>["data"]>;
type SubscriptionListData = NonNullable<InferResponseType<typeof getSubscriptions, 200>["data"]>;
type UserListData = NonNullable<InferResponseType<typeof getUsers, 200>["data"]>;

/** admin 模型列表行类型。 */
export type AdminCreditRow = CreditListData["items"][number];
export type AdminOrderRow = OrderListData["items"][number];
export type AdminSubscriptionRow = SubscriptionListData["items"][number];
export type AdminUserRow = UserListData["items"][number];

/** admin 模型创建请求体，直接从后端 zod schema 推导。 */
export type AiModelPayload = InferRequestType<typeof createAiModel>["json"];

const queries = {
  aiModels: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getAiModels(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<AiModelListData>(res, "Failed to load AI models");
      },
      queryKey: adminKeys.aiModels.page(page),
      placeholderData: keepPreviousData,
    }),
  config: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getAdminConfig(undefined, withAbort(signal));
        return unwrapQuery<AdminConfigData>(res, "Failed to load settings");
      },
      queryKey: adminKeys.config(),
    }),
  credits: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getCredits(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<CreditListData>(res, "Failed to load credits");
      },
      queryKey: adminKeys.credits(page),
      placeholderData: keepPreviousData,
    }),
  metrics: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getMetrics(undefined, withAbort(signal));
        return unwrapQuery<MetricsData>(res, "Failed to load metrics");
      },
      queryKey: adminKeys.metrics(),
    }),
  orders: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getOrders(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<OrderListData>(res, "Failed to load orders");
      },
      queryKey: adminKeys.orders(page),
      placeholderData: keepPreviousData,
    }),
  permissions: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getPermissions(undefined, withAbort(signal));
        return (await unwrapQuery<PermissionListData>(res, "Failed to load permissions")) ?? [];
      },
      queryKey: adminKeys.permissions(),
      staleTime: 5 * 60 * 1000,
    }),
  rolePermissions: (roleId: string | null) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getRolePermissions({ param: { id: roleId ?? "" } }, withAbort(signal));
        return (
          (await unwrapQuery<RolePermissionListData>(res, "Failed to load role permissions")) ?? []
        );
      },
      queryKey: adminKeys.roles.permissions(roleId),
    }),
  roles: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getRoles(undefined, withAbort(signal));
        return (await unwrapQuery<RoleListData>(res, "Failed to load roles")) ?? [];
      },
      queryKey: adminKeys.roles.all,
    }),
  subscriptions: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getSubscriptions(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<SubscriptionListData>(res, "Failed to load subscriptions");
      },
      queryKey: adminKeys.subscriptions(page),
      placeholderData: keepPreviousData,
    }),
  users: (page: number, search: string) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getUsers(
          {
            query: {
              page: String(page),
              pageSize: String(PAGE_SIZE),
              ...(search ? { search } : {}),
            },
          },
          withAbort(signal),
        );
        return unwrapQuery<UserListData>(res, "Failed to load users");
      },
      queryKey: adminKeys.users(page, search),
      placeholderData: keepPreviousData,
    }),
};

const mutations = {
  deleteAiModel: () =>
    mutationOptions({
      meta: { invalidates: [adminKeys.aiModels.all] },
      mutationFn: async (id: string) => {
        const res = await client.api.admin["ai-models"][":id"].$delete({ param: { id } });
        await assertOk(res, "Failed to delete AI model");
      },
    }),
  deleteRole: () =>
    mutationOptions({
      meta: { invalidates: [adminKeys.roles.all] },
      mutationFn: async (id: string) => {
        const res = await client.api.admin.roles[":id"].$delete({ param: { id } });
        await assertOk(res, "Failed to delete role");
      },
    }),
  saveAiModel: () =>
    mutationOptions({
      meta: { invalidates: [adminKeys.aiModels.all] },
      mutationFn: async (input: AiModelPayload & { id: string | null }) => {
        if (input.id) {
          const { id, ...body } = input;
          const res = await client.api.admin["ai-models"][":id"].$patch({
            json: body,
            param: { id },
          });
          await assertOk(res, "Failed to update AI model");
          return;
        }
        const res = await createAiModel({
          json: {
            provider: input.provider,
            modelId: input.modelId,
            displayName: input.displayName,
            mediaType: input.mediaType,
            creditPrice: input.creditPrice,
            maxOutputTokens: input.maxOutputTokens,
            optionsSchema: input.optionsSchema,
            metadata: input.metadata ?? null,
            enabled: input.enabled,
            sortOrder: input.sortOrder,
          },
        });
        if (res.status === 409) {
          throw new Error("Model already exists for this provider");
        }
        await assertOk(res, "Failed to create AI model");
      },
    }),
  toggleAiModel: () =>
    mutationOptions({
      meta: { invalidates: [adminKeys.aiModels.all] },
      mutationFn: async (input: { id: string; enabled: boolean }) => {
        const res = await client.api.admin["ai-models"][":id"].$patch({
          json: { enabled: input.enabled },
          param: { id: input.id },
        });
        await assertOk(res, "Failed to update AI model");
      },
    }),
  saveConfig: () =>
    mutationOptions({
      meta: { invalidates: [adminKeys.config()] },
      mutationFn: async (payload: Record<string, string>) => {
        const res = await client.api.admin.config.$post({ json: payload });
        await assertOk(res, "Failed to save");
      },
    }),
  saveRole: () =>
    mutationOptions({
      meta: { invalidates: [adminKeys.roles.all] },
      mutationFn: async (input: { id: string | null; name: string; title: string }) => {
        if (input.id) {
          const res = await client.api.admin.roles[":id"].$put({
            json: { name: input.name, title: input.title },
            param: { id: input.id },
          });
          await assertOk(res, "Failed to update role");
          return;
        }
        const res = await client.api.admin.roles.$post({
          json: { name: input.name, title: input.title },
        });
        await assertOk(res, "Failed to create role");
      },
    }),
  saveRolePermissions: () =>
    mutationOptions({
      meta: {
        invalidates: (input: { id: string; permissionIds: string[] }) =>
          [adminKeys.roles.permissions(input.id)] as const,
      },
      mutationFn: async (input: { id: string; permissionIds: string[] }) => {
        const res = await client.api.admin.roles[":id"].permissions.$put({
          json: { permissionIds: input.permissionIds },
          param: { id: input.id },
        });
        await assertOk(res, "Failed to save permissions");
      },
    }),
};

export const admin = { mutations, queries } as const;
