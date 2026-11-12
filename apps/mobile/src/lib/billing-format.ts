/** 金额以最小货币单位（分）存储，展示时除以 100。 */
const MINOR_UNIT_FACTOR = 100;

/** 后端币种代码（三字母小写）→ 展示用大写。 */
function normalizeCurrency(currency: string): string {
  return currency.toUpperCase();
}

/**
 * 把最小货币单位金额格式化为展示字符串。
 * 临时方案：Intl.NumberFormat 在 Hermes / JSC 下的行为差异较大，
 * 自行拼装 "US$29.00" 风格（金额除以 100），保证三端一致且可测。
 */
export function formatMinorAmount(amount: number, currency: string): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const units = Math.trunc(abs / MINOR_UNIT_FACTOR);
  const cents = abs % MINOR_UNIT_FACTOR;
  const centsText = cents.toString().padStart(2, "0");
  return `${sign}${normalizeCurrency(currency)}$${units}.${centsText}`;
}

/** ISO 日期字符串 → 本地化短日期（YYYY-MM-DD）；无效值返回 null。 */
export function formatIsoDate(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 积分流水页签：全部 / 发放 / 消费。 */
export type CreditsFilter = "all" | "grant" | "consume";

/** 一条积分流水（与 /user/credits 响应的 history 元素对齐，日期均为 ISO string）。 */
export interface CreditHistoryItem {
  credits: number;
  description?: string | null;
  expiresAt?: string | null;
  remainingCredits: number;
  transactionNo: string;
  transactionScene?: string | null;
  transactionType: string;
}

/** 按 transactionType 过滤流水：grant→发放、consume→消费，all 原样返回。 */
export function filterCreditHistory<TItem extends CreditHistoryItem>(
  items: readonly TItem[],
  filter: CreditsFilter,
): TItem[] {
  if (filter === "all") {
    return [...items];
  }
  return items.filter((item) => item.transactionType === filter);
}

/** 订单页签：全部 / 一次性 / 订阅。 */
export type OrdersFilter = "all" | "one-time" | "subscription";

/** 一条订单（与 /user/orders 响应的 items 元素对齐）。 */
export interface UserOrderItem {
  amount: number;
  currency: string;
  orderNo: string;
  paidAt?: string | null;
  paymentProvider: string;
  paymentType?: string | null;
  productName?: string | null;
  status: string;
}

/** 按支付类型过滤订单：one-time / subscription；all 原样返回。 */
export function filterOrders<TOrder extends UserOrderItem>(
  orders: readonly TOrder[],
  filter: OrdersFilter,
): TOrder[] {
  if (filter === "all") {
    return [...orders];
  }
  return orders.filter((order) => order.paymentType === filter);
}
