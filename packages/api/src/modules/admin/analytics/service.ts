import { CreditStatus, CreditTransactionType } from "../../billing/credits";
import { credit, order, subscription, user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { and, count, eq, sum } from "@openstarter/db/orm";

export interface AdminMetrics {
  creditsConsumed: number;
  orderCount: number;
  subscriptionCount: number;
  userCount: number;
}

function toCount(value: number | undefined): number {
  return value ?? 0;
}

function toConsumedTotal(total: string | null | undefined): number {
  return total ? Math.abs(Number.parseInt(total, 10)) : 0;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const database = db();
  const [userRows, orderRows, subscriptionRows, consumedRows] = await Promise.all([
    database.select({ value: count() }).from(user),
    database.select({ value: count() }).from(order),
    database.select({ value: count() }).from(subscription),
    database
      .select({ total: sum(credit.credits) })
      .from(credit)
      .where(
        and(
          eq(credit.transactionType, CreditTransactionType.CONSUME),
          eq(credit.status, CreditStatus.ACTIVE),
        ),
      ),
  ]);

  return {
    creditsConsumed: toConsumedTotal(consumedRows[0]?.total),
    orderCount: toCount(orderRows[0]?.value),
    subscriptionCount: toCount(subscriptionRows[0]?.value),
    userCount: toCount(userRows[0]?.value),
  };
}
