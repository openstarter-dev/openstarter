/**
 * 配置管理：读写 ~/.openstarter/config.json。
 *
 * 使用 conf 持久化，projectName='openstarter' 落到 ~/.openstarter/config.json。
 * 不可变 API：写入均生成新配置快照，不就地修改返回给调用方的引用。
 */

import Conf from 'conf';
import type { AuthTokens, CliConfig, StoredAuth } from '../types.js';

const DEFAULT_API_URL = 'https://app.openstarter.dev';

const SCHEMA = {
  apiUrl: { type: 'string' },
  auth: {
    properties: {
      accessToken: { type: 'string' },
      expiresAt: { type: 'number' },
      refreshToken: { type: 'string' },
    },
    type: 'object',
  },
} as const;

/** 配置管理器：维护 apiUrl 与 auth 段，封装过期判断。 */
export class ConfigManager {
  private readonly store: Conf<CliConfig>;

  constructor() {
    this.store = new Conf<CliConfig>({
      projectName: 'openstarter',
      defaults: { apiUrl: DEFAULT_API_URL },
      schema: SCHEMA,
    });
  }

  /** 返回配置快照（避免外部直接修改内部存储）。 */
  getConfig(): CliConfig {
    return structuredClone(this.store.store);
  }

  getApiUrl(): string {
    return this.store.get('apiUrl') ?? DEFAULT_API_URL;
  }

  setApiUrl(url: string): void {
    this.store.set('apiUrl', url);
  }

  /** 写入凭据：将相对 expiresIn 转为绝对过期时间戳。 */
  setAuth(tokens: AuthTokens): void {
    const auth: StoredAuth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    this.store.set('auth', auth);
  }

  clearAuth(): void {
    this.store.delete('auth');
  }

  /** 当前令牌是否仍有效（未过期）。 */
  isAuthenticated(): boolean {
    const auth = this.store.get('auth');
    if (!auth) {
      return false;
    }
    return Date.now() < auth.expiresAt;
  }

  /** 取有效访问令牌；未登录或已过期返回 undefined。 */
  getAccessToken(): string | undefined {
    const auth = this.store.get('auth');
    if (!auth || Date.now() >= auth.expiresAt) {
      return undefined;
    }
    return auth.accessToken;
  }
}

/** 进程级单例：命令实现共享同一配置存储。 */
export const config = new ConfigManager();
