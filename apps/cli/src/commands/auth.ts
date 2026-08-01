/**
 * 认证命令：login / logout / whoami。
 *
 * login  经设备授权流（deviceLogin）拿 token 并写入本地配置；
 * logout 清除本地凭据；
 * whoami 调用 /api/profile 校验当前会话并展示用户信息。
 */

import type { Command } from "commander";
import { createApiClient, requireAuthOrThrow } from "../lib/api-client.js";
import { deviceLogin } from "../lib/auth-client.js";
import { config } from "../lib/config.js";
import { handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";

/** whoami 返回字段（与 packages/api 的 /api/profile 响应 data 对齐）。 */
interface WhoamiProfile {
  readonly createdAt?: string;
  readonly email: string;
  readonly id: string;
  readonly name?: string;
}

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("登录到 openstarter 账户")
    .option("--api-url <url>", "指定 API 地址")
    .action(async (options) => {
      try {
        const apiUrl = options.apiUrl || config.getApiUrl();
        if (options.apiUrl) {
          config.setApiUrl(apiUrl);
        }

        const tokens = await deviceLogin(apiUrl);
        config.setAuth({
          accessToken: tokens.access_token,
          expiresIn: tokens.expires_in,
          refreshToken: "", // 设备授权流不返回 refresh token
        });

        console.log("\n✓ 登录成功！");
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command("logout")
    .description("登出并清除本地凭据")
    .action(() => {
      try {
        config.clearAuth();
        console.log("✓ 已登出");
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command("whoami")
    .description("显示当前登录的用户信息")
    .option("--json", "以 JSON 格式输出")
    .action(async (options) => {
      try {
        requireAuthOrThrow();
        const client = createApiClient();
        const profile = await client.request<WhoamiProfile>("/api/profile");
        formatOutput(profile, options.json);
      } catch (error) {
        handleError(error as Error, false);
      }
    });
}
