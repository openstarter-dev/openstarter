// packages/api/src/admin/service —— 管理后台只读列表服务（Admin_Console 数据面，R26.2）。
//
// 为后台的账单域（订单/订阅/积分）与用户列表提供分页只读投影。RBAC 自身（角色/权限/用户角色）
// 的管理端点在 routes/admin.ts；邀请码 CRUD 在 routes/admin.ts 追加；本服务仅承载「跨表只读列表」。
//
// 所有查询经 `@openstarter/db`（`db()` 单例 + `@openstarter/db/schema` 表定义）跨方言一致，
// 参数化查询（无字符串拼接）。分页统一 `{ items, total }`，供路由以 `respPage` 返回。
// 访问由 routes 层的 `requireAuth + requirePermission("admin.*")` 通配符 RBAC 保障。

import type { Credit, Order, Subscription, User } from "@openstarter/db/schema";
import { credit, order, subscription, user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { and, count, desc, eq, isNull, like, type SQL } from "drizzle-orm";

export interface AdminListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

export interface AdminListResult<TItem> {
  items: TItem[];
  total: number;
}

function offsetOf(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** 用户列表（可按名称/邮箱模糊搜索），按创建时间倒序。R26.2 */
export async function listUsers(params: AdminListParams): Promise<AdminListResult<User>> {
  const { page, pageSize, search } = params;
  const database = db();
  const where = search ? like(user.email, `%${search}%`) : undefined;

  const [items, totalRows] = await Promise.all([
    database
      .select()
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offsetOf(page, pageSize)),
    database.select({ value: count() }).from(user).where(where),
  ]);
  return { items, total: totalRows[0]?.value ?? 0 };
}

/** 订单列表（可按状态过滤），排除软删，按创建时间倒序。R26.2 */
export async function listOrders(params: AdminListParams): Promise<AdminListResult<Order>> {
  const { page, pageSize, status } = params;
  const database = db();
  const conditions: SQL[] = [isNull(order.deletedAt)];
  if (status) {
    conditions.push(eq(order.status, status));
  }
  const where = and(...conditions);

  const [items, totalRows] = await Promise.all([
    database
      .select()
      .from(order)
      .where(where)
      .orderBy(desc(order.createdAt))
      .limit(pageSize)
      .offset(offsetOf(page, pageSize)),
    database.select({ value: count() }).from(order).where(where),
  ]);
  return { items, total: totalRows[0]?.value ?? 0 };
}

/** 订阅列表(可按状态过滤)，排除软删，按创建时间倒序。R26.2 */
export async function listSubscriptions(
  params: AdminListParams,
): Promise<AdminListResult<Subscription>> {
  const { page, pageSize, status } = params;
  const database = db();
  const conditions: SQL[] = [isNull(subscription.deletedAt)];
  if (status) {
    conditions.push(eq(subscription.status, status));
  }
  const where = and(...conditions);

  const [items, totalRows] = await Promise.all([
    database
      .select()
      .from(subscription)
      .where(where)
      .orderBy(desc(subscription.createdAt))
      .limit(pageSize)
      .offset(offsetOf(page, pageSize)),
    database.select({ value: count() }).from(subscription).where(where),
  ]);
  return { items, total: totalRows[0]?.value ?? 0 };
}

/** 积分流水列表（可按交易类型过滤），排除软删，按创建时间倒序。R26.2 */
export async function listCredits(params: AdminListParams): Promise<AdminListResult<Credit>> {
  const { page, pageSize, status } = params;
  const database = db();
  const conditions: SQL[] = [isNull(credit.deletedAt)];
  if (status) {
    conditions.push(eq(credit.transactionType, status));
  }
  const where = and(...conditions);

  const [items, totalRows] = await Promise.all([
    database
      .select()
      .from(credit)
      .where(where)
      .orderBy(desc(credit.createdAt))
      .limit(pageSize)
      .offset(offsetOf(page, pageSize)),
    database.select({ value: count() }).from(credit).where(where),
  ]);
  return { items, total: totalRows[0]?.value ?? 0 };
}
