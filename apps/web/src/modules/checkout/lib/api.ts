// Mutation 工厂：checkout 模块（R10）
// 经类型化 Hono RPC 客户端发起结账。

import { mutationOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

import type { PricingCheckout } from "@/lib/marketing/pricing";

const mutations = {
  create: () =>
    mutationOptions({
      mutationFn: async (input: PricingCheckout) => {
        const res = await client.api.checkout.$post({
          json: {
            amount: input.amount,
            credits: input.credits,
            creditsValidDays: input.creditsValidDays,
            currency: input.currency,
            interval: input.interval,
            intervalCount: input.intervalCount,
            planName: input.planName,
            productId: input.productId,
            productName: input.planName ?? input.productId,
            type: input.type,
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
