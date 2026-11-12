import { defineEnv } from "envin";
import * as z from "zod";

import { envConfig, NodeEnv } from "@openstarter/shared/constants";

import type { Preset } from "envin/types";

export const preset = {
  id: "auth",
  server: {
    BETTER_AUTH_SECRET: z.string(),

    APPLE_CLIENT_ID: z.string().optional().default(""),
    APPLE_CLIENT_SECRET: z.string().optional().default(""),
    APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional().default(""),
    GOOGLE_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
    GITHUB_CLIENT_ID: z.string().optional().default(""),
    GITHUB_CLIENT_SECRET: z.string().optional().default(""),

    // 浏览器扩展页面 origin（chrome-extension://<id>）。留空则信任任意扩展 origin
    // （开发期 / 多构建 ID）；发布后钉到具体 ID 可收敛 CSRF 原点白名单。
    EXTENSION_ORIGIN: z.string().optional().default(""),

    SEED_EMAIL: z.email().optional().default("support@openstarter.dev"),
    SEED_PASSWORD: z.string().optional().default("Pa$$w0rd"),
  },
} as const satisfies Preset;

export const env = defineEnv({
  ...envConfig,
  ...preset,
  shared: {
    NODE_ENV: z.enum(NodeEnv).default(NodeEnv.DEVELOPMENT),
  },
});
