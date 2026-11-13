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
