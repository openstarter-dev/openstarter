// Superwall 客户端 API key（构建期 env）。备胎 provider：键全可选，缺省不报错。
// 不用 envin，理由同 revenuecat/env.ts。
import * as z from "zod";

const clientEnvSchema = z.object({
  EXPO_PUBLIC_SUPERWALL_APPLE_API_KEY: z.string().optional(),
  EXPO_PUBLIC_SUPERWALL_GOOGLE_API_KEY: z.string().optional(),
});

export const env = clientEnvSchema.parse({
  EXPO_PUBLIC_SUPERWALL_APPLE_API_KEY: process.env.EXPO_PUBLIC_SUPERWALL_APPLE_API_KEY,
  EXPO_PUBLIC_SUPERWALL_GOOGLE_API_KEY: process.env.EXPO_PUBLIC_SUPERWALL_GOOGLE_API_KEY,
});
