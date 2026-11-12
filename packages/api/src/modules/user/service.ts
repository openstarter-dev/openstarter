// packages/api/src/user/service —— 面向当前用户的自助数据服务（Settings_Panel 数据面，R27）。
//
// 汇集 Settings_Panel（任务 34）所需的、以「当前登录用户」为范围的只读查询：
//   - 订单/支付记录（本服务 `listUserOrders`）：直接查 `order` 表（按 userId 过滤、排除软删），
//     供「支付记录」区块分页展示；不复用 billing 的支付编排（那是写路径），仅做读投影。
//   - 订阅状态视图、积分余额/历史、方案状态：分别复用 `@openstarter/billing`
//     （`getSubscriptionStatusView`/`getBalance`/`getHistory`）与 `@openstarter/auth`
//     （`getUserPlan`）的既有服务函数——本服务不重复其领域逻辑。
//
// 依赖分层 api → db（读投影）/ billing / auth，无反向、无环。所有查询均以路由中间件解析出的
// `userId` 为范围，天然隔离他人数据（R27：仅本人自助数据）。

import { CreditStatus, CreditTransactionType } from "@openstarter/billing-web/credits";
import { apikey, credit, order, user as userTable } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

export type UserOrder = typeof order.$inferSelect;

// ─── 用户资料（Profile） ──────────────────────────────────────────────────────

/** 客户端可见的用户资料投影：仅暴露非敏感字段。 */
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

/** 读取当前用户资料；用户不存在返回 null（由路由映射 404）。 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const row = await db()
    .select(profileSelect)
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
    .then((rows) => rows[0]);
  return row ? toProfileView(row) : null;
}

/** 更新当前用户资料；用户不存在返回 null（由路由映射 404）。 */
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

/** 仪表盘趋势桶：某一天的授予 / 消耗积分合计。 */
export interface DashboardTrendPoint {
  consumed: number;
  date: string;
  granted: number;
}

/** 仪表盘消费总额（按最近一笔已支付订单的币种聚合，混合币种不做跨币种求和）。 */
export interface DashboardSpendTotal {
  currency: string;
  total: number;
}

/** 仪表盘汇总统计（GET /user/dashboard-stats）。 */
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

/**
 * 分页返回当前用户的订单（支付记录），按创建时间倒序，排除软删（`deletedAt` 非空）。
 * 仅以 `userId` 为范围——不暴露他人订单（R27 自助数据隔离）。
 */
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

/** 仪表盘趋势/窗口统计的天数。 */
const DASHBOARD_WINDOW_DAYS = 30;

/** 将日期归一为 `YYYY-MM-DD`（UTC），作为趋势桶的键。 */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 仪表盘汇总统计：近 30 天积分授予/消耗、订单数与已支付消费、活跃 API Key 数，
 * 以及逐日积分趋势（30 桶，含无活动补零）。
 *
 * 全部查询均以 `userId` 为范围（与 {@link listUserOrders} 的自助数据隔离口径一致），
 * 六项聚合互不依赖，经 `Promise.all` 并行执行。积分口径复用 billing 的领域常量：
 * 授予 = `grant` + `active`；消耗 = `consume` + `active`（已撤销的消费不计入，为净消耗）。
 * 消费总额按「最近一笔已支付订单的币种」聚合，混合币种不做跨币种求和。
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const database = db();

  const windowStart = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const creditWindow = and(
    eq(credit.userId, userId),
    gte(credit.createdAt, windowStart),
    eq(credit.status, CreditStatus.ACTIVE),
  );

  const [grantedRows, consumedRows, ordersRows, paidRows, latestCurrencyRows, apikeyRows] =
    await Promise.all([
      database
        .select({ value: sql<number>`coalesce(sum(${credit.credits}), 0)` })
        .from(credit)
        .where(and(creditWindow, eq(credit.transactionType, CreditTransactionType.GRANT))),
      database
        .select({ value: sql<number>`coalesce(sum(abs(${credit.credits})), 0)` })
        .from(credit)
        .where(and(creditWindow, eq(credit.transactionType, CreditTransactionType.CONSUME))),
      database
        .select({ value: count() })
        .from(order)
        .where(and(eq(order.userId, userId), isNull(order.deletedAt))),
      database
        .select({ value: count() })
        .from(order)
        .where(and(eq(order.userId, userId), isNull(order.deletedAt), eq(order.status, "paid"))),
      // 最近一笔已支付订单的币种（desc 限 1），消费总额按该币种聚合。
      database
        .select({ currency: order.currency })
        .from(order)
        .where(and(eq(order.userId, userId), isNull(order.deletedAt), eq(order.status, "paid")))
        .orderBy(desc(order.createdAt))
        .limit(1),
      database
        .select({ value: count() })
        .from(apikey)
        .where(
          and(eq(apikey.userId, userId), eq(apikey.status, "active"), isNull(apikey.deletedAt)),
        ),
    ]);

  const latestCurrency = latestCurrencyRows[0]?.currency;
  const spendRows = latestCurrency
    ? await database
        .select({ total: sql<number>`coalesce(sum(${order.amount}), 0)` })
        .from(order)
        .where(
          and(
            eq(order.userId, userId),
            isNull(order.deletedAt),
            eq(order.status, "paid"),
            eq(order.currency, latestCurrency),
          ),
        )
    : [];

  // 逐日趋势桶：UTC 日粒度，窗口内无活动的日期补零，保证曲线横轴稳定。
  // （GROUP BY 复用同一 date(...) 表达式——SQLite 不接受按列别名分组。）
  const trendRows = await database
    .select({
      bucket: sql<string>`date(${credit.createdAt} / 1000, 'unixepoch')`,
      granted: sql<number>`coalesce(sum(case when ${credit.transactionType} = 'grant' then abs(${credit.credits}) else 0 end), 0)`,
      consumed: sql<number>`coalesce(sum(case when ${credit.transactionType} = 'consume' then abs(${credit.credits}) else 0 end), 0)`,
    })
    .from(credit)
    .where(creditWindow)
    .groupBy(sql`date(${credit.createdAt} / 1000, 'unixepoch')`);

  const byDay = new Map(trendRows.map((row) => [row.bucket, row]));
  const trend: DashboardTrendPoint[] = Array.from({ length: DASHBOARD_WINDOW_DAYS }, (_, index) => {
    const date = toDateKey(
      new Date(Date.now() - (DASHBOARD_WINDOW_DAYS - 1 - index) * 24 * 60 * 60 * 1000),
    );
    const row = byDay.get(date);
    return {
      consumed: row ? Math.abs(Number(row.consumed)) : 0,
      date,
      granted: row ? Math.abs(Number(row.granted)) : 0,
    };
  });

  const toNumber = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
    return Number.isNaN(parsed) ? 0 : Math.abs(parsed);
  };

  return {
    activeApiKeys: toNumber(apikeyRows[0]?.value),
    creditsConsumed30d: toNumber(consumedRows[0]?.value),
    creditsGranted30d: toNumber(grantedRows[0]?.value),
    ordersCount: toNumber(ordersRows[0]?.value),
    paidOrdersCount: toNumber(paidRows[0]?.value),
    spendTotal: latestCurrency
      ? { currency: latestCurrency.toUpperCase(), total: toNumber(spendRows[0]?.total) }
      : null,
    trend,
  };
}
