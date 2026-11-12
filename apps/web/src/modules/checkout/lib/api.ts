import { mutationOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client, unwrapMutation } from "@/lib/api";

import type { PricingCheckout } from "@/lib/marketing/pricing";

type CheckoutData = NonNullable<InferResponseType<typeof client.api.checkout.$post, 200>["data"]>;

const mutations = {
  create: () =>
    mutationOptions({
      mutationFn: async (input: Pick<PricingCheckout, "productId">) => {
        const res = await client.api.checkout.$post({
          json: { productId: input.productId },
        });
        return unwrapMutation<CheckoutData>(res, "Checkout failed");
      },
    }),
};

export const checkout = { mutations } as const;
