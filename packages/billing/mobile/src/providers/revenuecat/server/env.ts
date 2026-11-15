import * as z from "zod";

/**
 * revenuecat 服务端环境变量：模块加载即校验（fail-fast），缺失直接启动报错。
 * 取代原 envin defineEnv —— 直接以 zod 校验 process.env。
 * （client 侧 env.ts 仍刻意延迟读取，避免未配 key 的设备崩溃。）
 */
const envSchema = z.object({
  REVENUECAT_API_KEY: z.string(),
  REVENUECAT_WEBHOOK_SECRET: z.string(),
});

export type RevenuecatServerEnv = z.infer<typeof envSchema>;

export const env: RevenuecatServerEnv = envSchema.parse(process.env);
