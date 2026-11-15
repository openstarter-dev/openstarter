import { CreditStatus, CreditTransactionType } from "@openstarter/billing-web/credits";
import { apikey, credit, order, user as userTable } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { and, count, desc, eq, gt, gte, isNull, or, sql } from "@openstarter/db/orm";

export type UserOrder = typeof order.$inferSelect;

export interface UserProfile {
  createdAt: Date | null;
  email: string;
  id: string;
  name: string;
}

const profileSelect = {
  createdAt: userTable.createdAt,
  email: userTable.email,
  id: userTable.id,
  name: userTable.name,
} as const;

function toProfileView(row: {
  createdAt: Date | null;
  email: string;
  id: string;
  name: string | null;
}): UserProfile {
  return {
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    name: row.name ?? "",
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const row = await db()
    .select(profileSelect)
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
    .then((rows) => rows[0]);
  return row ? toProfileView(row) : null;
}

export async function updateUserProfile(
  userId: string,
  input: { name: string },
): Promise<UserProfile | null> {
  const updated = await db()
    .update(userTable)
    .set({ name: input.name })
    .where(eq(userTable.id, userId))
    .returning(profileSelect)
    .then((rows) => rows[0]);
  return updated ? toProfileView(updated) : null;
}

export interface DashboardTrendPoint {
  consumed: number;
  date: string;
  granted: number;
}

export interface DashboardSpendTotal {
  currency: string;
  total: number;
}

export interface DashboardStats {
  activeApiKeys: number;
  creditsConsumed30d: number;
  creditsGranted30d: number;
  ordersCount: number;
  paidOrdersCount: number;
  spendTotal: DashboardSpendTotal | null;
  trend: DashboardTrendPoint[];
}

export interface ListUserOrdersParams {
  page: number;
  pageSize: number;
  userId: string;
}

export interface ListUserOrdersResult {
  items: UserOrder[];
  total: number;
}

export async function listUserOrders(params: ListUserOrdersParams): Promise<ListUserOrdersResult> {
  const { userId, page, pageSize } = params;
  const database = db();
  const where = and(eq(order.userId, userId), isNull(order.deletedAt));

  const [items, totalRows] = await Promise.all([
    database
      .select()
      .from(order)
      .where(where)
      .orderBy(desc(order.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    database.select({ value: count() }).from(order).where(where),
  ]);

  return { items, total: totalRows[0]?.value ?? 0 };
}

const DASHBOARD_WINDOW_DAYS = 30;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Aggregate 30-day credit grants and consumptions by UTC date in JS to avoid dialect-specific SQL.
 * 在应用层按 UTC 日期聚合 30 天积分发放与消耗，避免依赖 SQLite 专属时间函数。
 */
function aggregateTrendByDay(
  rows: readonly { createdAt: Date; credits: number; transactionType: string }[],
): Map<string, { consumed: number; granted: number }> {
  const byDay = new Map<string, { consumed: number; granted: number }>();
  for (const row of rows) {
    const key = toDateKey(row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt));
    const entry = byDay.get(key) ?? { consumed: 0, granted: 0 };
    const amount = Math.abs(row.credits);
    if (row.transactionType === CreditTransactionType.GRANT) {
      entry.granted += amount;
    } else if (row.transactionType === CreditTransactionType.CONSUME) {
      entry.consumed += amount;
    }
    byDay.set(key, entry);
  }
  return byDay;
}

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isNaN(parsed) ? 0 : Math.abs(parsed);
};

/**
 * Dashboard aggregates in 3 round trips instead of one query per metric:
 * 1. credit window rows → 30-day trend buckets + grant/consume sums (JS aggregation)
 * 2. orders grouped by currency → total/paid counts, per-currency paid totals, latest paid currency
 * 3. active API keys count
 * 仪表盘聚合压缩为 3 次往返：积分窗口行一次取回在 JS 聚合，订单按币种分组一次取全。
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const database = db();

  const windowStart = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const creditWindow = and(
    eq(credit.userId, userId),
    gte(credit.createdAt, windowStart),
    eq(credit.status, CreditStatus.ACTIVE),
  );

  const [trendRows, orderGroups, apikeyRows] = await Promise.all([
    database
      .select({
        createdAt: credit.createdAt,
        credits: credit.credits,
        transactionType: credit.transactionType,
      })
      .from(credit)
      .where(creditWindow),
    database
      .select({
        currency: order.currency,
        ordersCount: count(),
        paidCount: sql<number>`coalesce(sum(case when ${order.status} = 'paid' then 1 else 0 end), 0)`,
        paidTotal: sql<number>`coalesce(sum(case when ${order.status} = 'paid' then ${order.amount} else 0 end), 0)`,
        lastPaidAt: sql<
          number | null
        >`max(case when ${order.status} = 'paid' then ${order.createdAt} end)`,
      })
      .from(order)
      .where(and(eq(order.userId, userId), isNull(order.deletedAt)))
      .groupBy(order.currency),
    database
      .select({ value: count() })
      .from(apikey)
      .where(
        and(
          eq(apikey.referenceId, userId),
          eq(apikey.enabled, true),
          or(isNull(apikey.expiresAt), gt(apikey.expiresAt, new Date())),
        ),
      ),
  ]);

  // Bucket the window rows by day; the same rows also yield the 30-day grant/consume totals.
  // 窗口行按天分桶；同一批行同时得出 30 天发放/消耗合计。
  const byDay = aggregateTrendByDay(trendRows);
  let creditsGranted30d = 0;
  let creditsConsumed30d = 0;
  for (const entry of byDay.values()) {
    creditsGranted30d += entry.granted;
    creditsConsumed30d += entry.consumed;
  }

  const trend: DashboardTrendPoint[] = Array.from({ length: DASHBOARD_WINDOW_DAYS }, (_, index) => {
    const date = toDateKey(
      new Date(Date.now() - (DASHBOARD_WINDOW_DAYS - 1 - index) * 24 * 60 * 60 * 1000),
    );
    const row = byDay.get(date);
    return {
      consumed: row ? row.consumed : 0,
      date,
      granted: row ? row.granted : 0,
    };
  });

  // Reduce currency groups: totals, paid totals, and the most recently paid currency.
  // 归并币种分组：总数、paid 数、最近一次 paid 的币种及其消费合计。
  let ordersCount = 0;
  let paidOrdersCount = 0;
  let latestPaidAt = Number.NEGATIVE_INFINITY;
  let spendTotal: DashboardSpendTotal | null = null;

  for (const group of orderGroups) {
    const paidCount = toNumber(group.paidCount);
    ordersCount += toNumber(group.ordersCount);
    paidOrdersCount += paidCount;

    const lastPaidAt = group.lastPaidAt === null ? undefined : Number(group.lastPaidAt);
    if (lastPaidAt !== undefined && lastPaidAt > latestPaidAt) {
      latestPaidAt = lastPaidAt;
      spendTotal = {
        currency: group.currency.toUpperCase(),
        total: toNumber(group.paidTotal),
      };
    }
  }

  return {
    activeApiKeys: toNumber(apikeyRows[0]?.value),
    creditsConsumed30d: creditsConsumed30d,
    creditsGranted30d: creditsGranted30d,
    ordersCount,
    paidOrdersCount,
    spendTotal,
    trend,
  };
}
