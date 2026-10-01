// RevenueCat 客户端 SDK key（构建期 env，Expo 构建时内联 process.env）。
// 不用 envin：模块加载期 required 校验会让未配 key 的设备直接崩溃；
// IAP 是可选能力，缺 key = 降级不可用（由 provider 运行时判定）。spec §4.2/§9。
import * as z from "zod";

const clientEnvSchema = z.object({
  EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY: z.string().optional(),
  EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY: z.string().optional(),
});

export const env = clientEnvSchema.parse({
  EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY,
  EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY,
});
