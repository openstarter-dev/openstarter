/**
 * Device Authorization (RFC 8628) 客户端。
 *
 * 与 Better Auth deviceAuthorization 插件端点交互：
 *   - POST /api/auth/device/code  → 设备码 + 用户码（需 client_id）
 *   - POST /api/auth/device/token → 轮询换取会话 token（access_token）
 *
 * token 端点在用户尚未批准时返回 400 + `{ error: "authorization_pending" }`，
 * 在批准后返回 `{ access_token, token_type, expires_in, scope }`。
 */

import type { DeviceCodeResponse, DeviceTokenErrorResponse, TokenResponse } from "../types.js";
import { NetworkError } from "./errors.js";

/** CLI 作为单一公共客户端的标识（deviceAuthorization 插件用于校验/绑定 client_id）。 */
const CLI_CLIENT_ID = "openstarter-cli";

const DEVICE_CODE_ENDPOINT = "/api/auth/device/code";
const DEVICE_TOKEN_ENDPOINT = "/api/auth/device/token";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** 请求设备码与用户码。 */
export async function requestDeviceCode(apiUrl: string): Promise<DeviceCodeResponse> {
  try {
    const response = await fetch(`${apiUrl}${DEVICE_CODE_ENDPOINT}`, {
      body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to request device code: ${response.statusText} ${text}`);
    }

    return (await response.json()) as DeviceCodeResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw new NetworkError(`无法请求设备码: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * 轮询 token 端点，直到用户批准或超时。
 * authorization_pending 时按 interval 继续；其余错误抛出。
 */
export async function pollForToken(
  apiUrl: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<TokenResponse> {
  const startTime = Date.now();
  const timeout = expiresIn * 1000;

  while (Date.now() - startTime < timeout) {
    // biome-ignore lint/performance/noAwaitInLoops: 设备授权轮询必须串行等待 interval，否则会瞬间打满 token 端点。
    await sleep(interval * 1000);

    let response: Response;
    try {
      response = await fetch(`${apiUrl}${DEVICE_TOKEN_ENDPOINT}`, {
        body: JSON.stringify({
          client_id: CLI_CLIENT_ID,
          device_code: deviceCode,
          grant_type: DEVICE_GRANT_TYPE,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new NetworkError(`轮询 token 失败: ${error.message}`, {
          cause: error,
        });
      }
      throw error;
    }

    if (response.ok) {
      return (await response.json()) as TokenResponse;
    }

    let body: DeviceTokenErrorResponse;
    try {
      body = (await response.json()) as DeviceTokenErrorResponse;
    } catch (error) {
      const text = await response.text().catch(() => "");
      throw new NetworkError(`token 端点返回非 JSON: ${response.status} ${text}`, { cause: error });
    }

    const errorCode = body.error;
    if (errorCode === "authorization_pending") {
      continue;
    }
    if (errorCode === "slow_down") {
      await sleep(interval * 1000);
      continue;
    }
    throw new NetworkError(body.error_description ?? errorCode ?? `授权失败 (${response.status})`);
  }

  throw new NetworkError("授权超时，请在 10 分钟内完成设备授权");
}

/**
 * 完整设备授权登录流：请求码 → 提示用户 → 轮询至完成。
 * 返回 token 响应（access_token 即会话 token，供 Bearer 转发）。
 */
export async function deviceLogin(apiUrl: string): Promise<TokenResponse> {
  const deviceCodeResponse = await requestDeviceCode(apiUrl);

  const verifyUrl =
    deviceCodeResponse.verification_uri_complete ?? deviceCodeResponse.verification_uri;
  console.log("\n请访问:", verifyUrl);
  console.log("并输入代码:", deviceCodeResponse.user_code);
  console.log("\n等待授权...\n");

  const tokens = await pollForToken(
    apiUrl,
    deviceCodeResponse.device_code,
    deviceCodeResponse.interval,
    deviceCodeResponse.expires_in,
  );

  return tokens;
}
