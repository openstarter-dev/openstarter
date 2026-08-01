/**
 * CLI 错误类型与统一处理。
 *
 * 退出码约定：0 成功 / 1 一般错误 / 2 认证错误 / 3 网络错误 / 4 配置错误。
 * 每个错误类对应一个退出码，handleError 负责映射并终止进程。
 */

/** 认证错误（未登录、令牌过期）——退出码 2。 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** 网络错误（无法连接 API、请求失败）——退出码 3。 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** 配置错误（配置文件损坏、地址非法）——退出码 4。 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** API 错误（服务端返回非 2xx，附带状态码）——退出码 1（认证相关子类优先匹配）。 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 统一错误出口：按错误类型映射退出码，输出可读消息后终止进程。
 * 认证/网络/配置错误附带可操作提示；其余错误在 verbose 时打印堆栈。
 */
export function handleError(error: Error, verbose: boolean): never {
  if (error instanceof AuthError) {
    console.error('❌ 认证错误:', error.message);
    console.error('请运行 `openstarter login` 重新登录');
    process.exit(2);
  }

  if (error instanceof NetworkError) {
    console.error('❌ 网络错误:', error.message);
    console.error('请检查网络连接和 API 地址');
    process.exit(3);
  }

  if (error instanceof ConfigError) {
    console.error('❌ 配置错误:', error.message);
    process.exit(4);
  }

  console.error('❌ 错误:', error.message);
  if (verbose) {
    console.error(error.stack);
  }
  process.exit(1);
}
