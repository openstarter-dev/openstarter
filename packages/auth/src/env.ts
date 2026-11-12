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

    // 跨端来源白名单（trustedOrigins 的显式扩展项）。
    //
    // better-auth 会对带 cookie 的请求做 CSRF 原点校验，来源必须精确命中白名单。
    // 这里默认「空」= 只信任 baseURL 自身 origin + 内置项（移动端 scheme、
    // Apple 登录域名），不再默认信任任意扩展 / 任意自定义 scheme。
    //
    // - EXTENSION_ORIGIN：浏览器扩展页面 origin，如 chrome-extension://abcdef…；
    //   扩展以 Bearer 桥接会话时不需要它，仅在扩展页面直接发起带 cookie 的请求时才要配。
    // - TRUSTED_ORIGINS：逗号分隔的额外来源，用于自建域名、局域网调试（http://192.168.x.x:3000）等。
    EXTENSION_ORIGIN: z.string().optional().default(""),
    TRUSTED_ORIGINS: z.string().optional().default(""),

    // 移动端深链 scheme（与 apps/mobile/app.config.ts 的 `scheme` 保持一致）。
    // 仅作为 `${scheme}://` 进入 trustedOrigins，供 OAuth 回跳校验；改名需两端同步。
    MOBILE_APP_SCHEME: z.string().optional().default("openstarter"),

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
