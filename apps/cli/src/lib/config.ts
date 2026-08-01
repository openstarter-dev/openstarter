/**
 * 配置管理：读写 ~/.openstarter/config.json。
 *
 * 使用 conf 持久化，projectName='openstarter' 落到 ~/.openstarter/config.json。
 * 不可变 API：写入均生成新配置快照，不就地修改返回给调用方的引用。
 *
 * 启动开销控制：ConfigManager 构造会同步读盘建 Conf 实例，故懒加载到首次访问。
 * --version/--help 与未鉴权命令不再为其付出 ~数十毫秒的启动成本。
 */

import Conf from "conf";
import type { AuthTokens, CliConfig, StoredAuth } from "../types.js";

// 默认凭据 fallback：硬编码的兜底 origin，仅当环境变量与配置文件都没有时使用。
const HARDCODED_FALLBACK_URL = "https://app.openstarter.dev";

/**
 * 解析默认 API URL：优先读根 .env 通过进程环境注入的 OPENSTARTER_API_URL
 * （与 mobile/extension/desktop 统一的唯一事实源），缺失再回落硬编码兜底。
 * 取值在 ConfigManager 实例化时计算一次，避免每次读取都访问 process.env。
 */
function resolveDefaultApiUrl(): string {
  const fromEnv = process.env.OPENSTARTER_API_URL;
  if (fromEnv?.trim()) {
    return fromEnv.trim();
  }
  return HARDCODED_FALLBACK_URL;
}

const DEFAULT_API_URL = resolveDefaultApiUrl();

const SCHEMA = {
  apiUrl: { type: "string" },
  auth: {
    properties: {
      accessToken: { type: "string" },
      expiresAt: { type: "number" },
      refreshToken: { type: "string" },
    },
    type: "object",
  },
} as const;

/** 配置管理器：维护 apiUrl 与 auth 段，封装过期判断。 */
export class ConfigManager {
  private readonly store: Conf<CliConfig>;

  constructor() {
    this.store = new Conf<CliConfig>({
      defaults: { apiUrl: DEFAULT_API_URL },
      projectName: "openstarter",
      schema: SCHEMA,
    });
  }

  /** 返回配置快照（避免外部直接修改内部存储）。 */
  getConfig(): CliConfig {
    return structuredClone(this.store.store);
  }

  getApiUrl(): string {
    return this.store.get("apiUrl") ?? DEFAULT_API_URL;
  }

  setApiUrl(url: string): void {
    this.store.set("apiUrl", url);
  }

  /** 写入凭据：将相对 expiresIn 转为绝对过期时间戳。 */
  setAuth(tokens: AuthTokens): void {
    const auth: StoredAuth = {
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      refreshToken: tokens.refreshToken,
    };
    this.store.set("auth", auth);
  }

  clearAuth(): void {
    this.store.delete("auth");
  }

  /** 当前令牌是否仍有效（未过期）。 */
  isAuthenticated(): boolean {
    const auth = this.store.get("auth");
    if (!auth) {
      return false;
    }
    return Date.now() < auth.expiresAt;
  }

  /** 取有效访问令牌；未登录或已过期返回 undefined。 */
  getAccessToken(): string | undefined {
    const auth = this.store.get("auth");
    if (!auth || Date.now() >= auth.expiresAt) {
      return;
    }
    return auth.accessToken;
  }
}

// 懒加载单例：首次访问才构造，避免启动期无谓的读盘/实例化开销。
let _config: ConfigManager | undefined;

/** 进程级单例：命令实现共享同一配置存储。 */
export const config: ConfigManager = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (!_config) {
        _config = new ConfigManager();
      }
      const value = _config[prop as keyof ConfigManager];
      return typeof value === "function" ? value.bind(_config) : value;
    },
  }
) as ConfigManager;
