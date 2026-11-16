import {
  type NewCredit,
  type NewSubscription,
  type Subscription,
  subscription,
} from "../../db/schema";
import { db } from "../../db/server";
import { getSnowId, getUuid } from "@openstarter/shared/id";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  type BillingTransaction,
  calculateCreditExpirationTime,
  CreditTransactionScene,
  grant,
} from "./credits";
import { SubscriptionStatus } from "./payment/types";

export type UpdateSubscription = Partial<
  Omit<NewSubscription, "id" | "subscriptionNo" | "createdAt">
>;

const CURRENT_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PENDING_CANCEL,
  SubscriptionStatus.TRIALING,
] as const;

const DEFAULT_SUBSCRIPTION_DESCRIPTION = "Subscription Created";
const RENEWAL_CREDIT_DESCRIPTION = "Grant credit";

export type CreateSubscriptionParams = {
  userId: string;
  paymentProvider: string;
  subscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  status?: SubscriptionStatus;
  userEmail?: string;
  subscriptionNo?: string;
  subscriptionResult?: string;
  productId?: string;
  productName?: string;
  planName?: string;
  description?: string;
  amount?: number;
  currency?: string;
  interval?: string;
  intervalCount?: number;
  trialPeriodDays?: number;
  billingUrl?: string;
  creditsAmount?: number;
  creditsValidDays?: number;
  paymentProductId?: string;
  paymentUserId?: string;

  tx?: BillingTransaction;
};

export async function createSubscription(
  params: CreateSubscriptionParams,
): Promise<NewSubscription> {
  const record: NewSubscription = {
    id: getUuid(),
    subscriptionNo: params.subscriptionNo ?? getSnowId(),
    userId: params.userId,
    userEmail: params.userEmail ?? "",
    status: params.status ?? SubscriptionStatus.ACTIVE,
    paymentProvider: params.paymentProvider,
    subscriptionId: params.subscriptionId,
    subscriptionResult: params.subscriptionResult ?? null,
    productId: params.productId ?? null,
    description: params.description ?? DEFAULT_SUBSCRIPTION_DESCRIPTION,
    amount: params.amount ?? null,
    currency: params.currency ?? null,
    interval: params.interval ?? null,
    intervalCount: params.intervalCount ?? null,
    trialPeriodDays: params.trialPeriodDays ?? null,
    currentPeriodStart: params.currentPeriodStart,
    currentPeriodEnd: params.currentPeriodEnd,
    planName: params.planName ?? null,
    billingUrl: params.billingUrl ?? null,
    productName: params.productName ?? null,
    creditsAmount: params.creditsAmount ?? null,
    creditsValidDays: params.creditsValidDays ?? null,
    paymentProductId: params.paymentProductId ?? null,
    paymentUserId: params.paymentUserId ?? null,
  };

  if (params.tx) {
    await params.tx.insert(subscription).values(record);
  } else {
    await db().insert(subscription).values(record);
  }
  return record;
}

export async function findBySubscriptionNo(
  subscriptionNo: string,
): Promise<Subscription | undefined> {
  const [result] = await db()
    .select()
    .from(subscription)
    .where(eq(subscription.subscriptionNo, subscriptionNo));
  return result;
}

export async function findByProviderSubscriptionId(params: {
  provider: string;
  subscriptionId: string;
}): Promise<Subscription | undefined> {
  const [result] = await db()
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.paymentProvider, params.provider),
        eq(subscription.subscriptionId, params.subscriptionId),
      ),
    );
  return result;
}

export async function getCurrentSubscription(userId: string): Promise<Subscription | undefined> {
  const [result] = await db()
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, userId),
        inArray(subscription.status, [...CURRENT_SUBSCRIPTION_STATUSES]),
      ),
    )
    .orderBy(desc(subscription.createdAt))
    .limit(1);
  return result;
}

export async function updateBySubscriptionNo(
  subscriptionNo: string,
  data: UpdateSubscription,
): Promise<Subscription | undefined> {
  await db().update(subscription).set(data).where(eq(subscription.subscriptionNo, subscriptionNo));
  return findBySubscriptionNo(subscriptionNo);
}

export type CancelSubscriptionParams = {
  subscriptionNo: string;
  canceledAt?: Date;
  canceledEndAt?: Date | null;
  status?: SubscriptionStatus;
  canceledReason?: string;
  canceledReasonType?: string;
};

export function cancelSubscription(
  params: CancelSubscriptionParams,
): Promise<Subscription | undefined> {
  return updateBySubscriptionNo(params.subscriptionNo, {
    status: params.status ?? SubscriptionStatus.CANCELED,
    canceledAt: params.canceledAt ?? new Date(),
    canceledEndAt: params.canceledEndAt ?? null,
    canceledReason: params.canceledReason ?? null,
    canceledReasonType: params.canceledReasonType ?? null,
  });
}

export type RenewSubscriptionParams = {
  subscriptionNo: string;
  userId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  userEmail?: string;
  creditsAmount?: number | null;
  creditsValidDays?: number | null;
};

export type RenewSubscriptionResult = {
  subscription: Subscription | undefined;
  grantedCredit?: NewCredit;
};

export async function renewSubscription(
  params: RenewSubscriptionParams,
): Promise<RenewSubscriptionResult> {
  const updated = await updateBySubscriptionNo(params.subscriptionNo, {
    currentPeriodStart: params.currentPeriodStart,
    currentPeriodEnd: params.currentPeriodEnd,
  });

  const creditsAmount = params.creditsAmount ?? 0;
  if (creditsAmount <= 0) {
    return { subscription: updated };
  }

  const expiresAt = calculateCreditExpirationTime({
    creditsValidDays: params.creditsValidDays ?? 0,
    currentPeriodEnd: params.currentPeriodEnd,
  });

  const grantedCredit = await grant({
    userId: params.userId,
    userEmail: params.userEmail,
    credits: creditsAmount,
    scene: CreditTransactionScene.RENEWAL,
    subscriptionNo: params.subscriptionNo,
    description: RENEWAL_CREDIT_DESCRIPTION,
    expiresAt,
  });

  return { subscription: updated, grantedCredit };
}

export type SubscriptionStatusView = {
  hasSubscription: boolean;
  status: string | null;
  planName: string | null;
  nextBillingDate: Date | null;
};

export async function getSubscriptionStatusView(userId: string): Promise<SubscriptionStatusView> {
  const current = await getCurrentSubscription(userId);

  if (!current) {
    return {
      hasSubscription: false,
      status: null,
      planName: null,
      nextBillingDate: null,
    };
  }

  return {
    hasSubscription: true,
    status: current.status,
    planName: current.planName ?? current.productName ?? null,
    nextBillingDate: current.currentPeriodEnd ?? null,
  };
}
