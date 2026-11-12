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
