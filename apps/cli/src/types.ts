/**
 * CLI 共享类型定义。
 *
 * 仅描述 CLI 侧关心的数据形状：本地配置结构、OAuth 2.0 设备授权（RFC 8628）
 * 端点响应，以及 API 错误信封。服务端真实类型由 @openstarter/api 的 RPC 类型推导，
 * CLI 不直接依赖服务端类型以保持启动开销与体积。
 */

/** 本地凭据（~/.openstarter/config.json 的 auth 段）——存储绝对过期时间。 */
export interface StoredAuth {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}

/** 完整本地配置。`apiUrl` 始终存在，`auth` 仅在登录后写入。 */
export interface CliConfig {
  apiUrl: string;
  auth?: StoredAuth;
}

/** 登录成功后由设备授权 token 端点返回的令牌——相对有效期（秒）。 */
export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

/** RFC 8628 设备码响应。 */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

/** RFC 8628 token 端点成功响应。 */
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/** 统一 API 响应信封（对齐 @openstarter/shared 的 `{ code, message, data? }`）。 */
export interface ApiResponse<TData = unknown> {
  code: number;
  data?: TData;
  message: string;
}

/** RFC 8628 token 端点错误响应。 */
export interface DeviceTokenErrorResponse {
  error: string;
  error_description?: string;
}
