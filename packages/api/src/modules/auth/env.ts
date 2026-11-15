import * as z from "zod";

import { NodeEnv } from "@openstarter/shared/constants";

/**
 * auth 服务端环境变量：模块加载即校验（fail-fast），缺失或非法值直接启动报错。
 * 取代原 envin defineEnv —— 未用到 client 前缀强制，直接以 zod 校验 process.env。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(NodeEnv).default(NodeEnv.DEVELOPMENT),

  BETTER_AUTH_SECRET: z.string(),

  APPLE_CLIENT_ID: z.string().optional().default(""),
  APPLE_CLIENT_SECRET: z.string().optional().default(""),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GITHUB_CLIENT_ID: z.string().optional().default(""),
  GITHUB_CLIENT_SECRET: z.string().optional().default(""),

  EXTENSION_ORIGIN: z.string().optional().default(""),
  TRUSTED_ORIGINS: z.string().optional().default(""),

  MOBILE_APP_SCHEME: z.string().optional().default("openstarter"),

  SEED_EMAIL: z.email().optional().default("support@openstarter.dev"),
  SEED_PASSWORD: z.string().optional().default("Pa$$w0rd"),
});

export type AuthEnv = z.infer<typeof envSchema>;

export const env: AuthEnv = envSchema.parse(process.env);
