// apps/desktop/src/log.ts —— 桌面端统一日志封装。
//
// 全仓库不直接使用 console（ultracite/biome 的 noConsole 规则约束），主进程与各纯逻辑
// 模块统一经这三个函数落日志，写入 process.stdout / process.stderr 并带 [desktop] 前缀。
// 参照 packages/shared/src/logger.ts 的既有先例。

const PREFIX = "[desktop]";

function writeLine(stream: NodeJS.WritableStream, args: unknown[]): void {
  const message = args
    .map((arg) => (arg instanceof Error ? (arg.stack ?? arg.message) : String(arg)))
    .join(" ");
  stream.write(`${PREFIX} ${message}\n`);
}

export function logInfo(...args: unknown[]): void {
  writeLine(process.stdout, args);
}

export function logWarn(...args: unknown[]): void {
  writeLine(process.stderr, args);
}

export function logError(...args: unknown[]): void {
  writeLine(process.stderr, args);
}
