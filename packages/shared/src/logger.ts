// @openstarter/shared/logger 子路径入口。
// 提供跨运行时（Node / Cloudflare Workers）可用的最小日志封装，满足 Auth_Service 现有引用：
//   - packages/auth/src/server.ts 通过 `logger: { log: (level, ...args) => logger[level](...args) }`
//     将 better-auth 的日志级别转发到这里，故 logger 需覆盖 better-auth 的全部日志级别方法。

/**
 * 日志级别，覆盖 better-auth logger 适配所需的级别（含 success）。
 */
export type LogLevel = "info" | "success" | "warn" | "error" | "debug";

/**
 * 单个日志方法签名。使用可变参数以兼容 `logger[level](message, ...args)` 的调用方式。
 */
type LogFn = (...args: unknown[]) => void;

/**
 * logger 形状：每个日志级别对应一个日志方法。
 * 以 Record<LogLevel, LogFn> 表达，使 `logger[level]` 在调用方（auth）处稳定可索引且可调用。
 */
export type Logger = Record<LogLevel, LogFn>;

/**
 * 受控的底层输出通道：console 在 Node 与 Cloudflare Workers 运行时均可用，
 * 因此作为跨运行时的日志落地点。此处集中封装，是本包唯一直接触及 console 的位置，
 * 其余代码一律经 `logger` 调用而不直接使用 console。
 */
const sink = (level: LogLevel, args: unknown[]): void => {
  // biome-ignore lint/suspicious/noConsole: 受控且集中的底层日志输出通道，跨运行时可用；本包唯一的 console 触点。
  const out = console;
  switch (level) {
    case "error":
      out.error(...args);
      break;
    case "warn":
      out.warn(...args);
      break;
    case "debug":
      out.debug(...args);
      break;
    default:
      // info 与 success 归并到标准信息输出。
      out.info(...args);
      break;
  }
};

/**
 * 共享 logger 实例。供 auth/email/billing 等能力域安全消费（位于依赖图底层，不反向依赖上层包）。
 */
export const logger: Logger = {
  info: (...args) => sink("info", args),
  success: (...args) => sink("success", args),
  warn: (...args) => sink("warn", args),
  error: (...args) => sink("error", args),
  debug: (...args) => sink("debug", args),
};
