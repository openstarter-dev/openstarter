import { z } from "zod";

export const checkoutBody = z.object({
  productId: z.string().min(1),
  provider: z.string().min(1).optional(),
});
