// Mutation 工厂：checkout 模块（R10）
// 经类型化 Hono RPC 客户端发起结账。

import { mutationOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

import type { PricingCheckout } from "@/lib/marketing/pricing";

const mutations = {
  create: () =>
    mutationOptions({
      mutationFn: async (checkout: PricingCheckout) => {
        const res = await client.api.checkout.$post({
          json: {
            amount: checkout.amount,
            credits: checkout.credits,
            creditsValidDays: checkout.creditsValidDays,
            currency: checkout.currency,
            interval: checkout.interval,
            intervalCount: checkout.intervalCount,
            planName: checkout.planName,
            productId: checkout.productId,
            productName: checkout.planName ?? checkout.productId,
            type: checkout.type,
          },
        });
        const json = await res.json();
        if ("code" in json && json.code === 0 && json.data) {
          return json.data as {
            checkoutUrl?: string;
            orderNo?: string;
            qrData?: { amount: number; codeUrl: string };
          };
        }
        const message =
          "message" in json && typeof json.message === "string"
            ? json.message
            : "Checkout failed";
        throw new Error(message);
      },
    }),
};

export const checkout = { mutations } as const;

