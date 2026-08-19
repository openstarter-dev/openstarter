/**
 * 输出格式化：JSON / 人类可读（表格、键值对）。
 *
 * 所有命令统一经 formatOutput 出口：`--json` 输出标准 JSON（便于脚本消费），
 * 否则按数据形状渲染为表格（数组）或键值对（对象）。
 */

/** 主出口：按 json 开关输出。 */
export function formatOutput(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  formatHumanReadable(data);
}

function formatHumanReadable(data: unknown): void {
  if (Array.isArray(data)) {
    formatTable(data as Record<string, unknown>[]);
    return;
  }
  if (data !== null && typeof data === "object") {
    formatKeyValue(data as Record<string, unknown>);
    return;
  }
  console.log(data);
}

const MAX_COLUMN_WIDTH = 40;
const TRUNCATE_SUFFIX = "...";

/** 表格输出：列宽自适应，单列上限 40 字符，过长截断。 */
export function formatTable(data: Record<string, unknown>[]): void {
  if (data.length === 0) {
    console.log("(empty)");
    return;
  }

  const [firstRow] = data;
  if (!firstRow) {
    console.log("(empty)");
    return;
  }

  const keys = Object.keys(firstRow);
  if (keys.length === 0) {
    console.log("(empty)");
    return;
  }

  const columnWidths = keys.map((key) => {
    const maxLength = Math.max(key.length, ...data.map((row) => String(row[key] ?? "").length));
    return Math.min(maxLength, MAX_COLUMN_WIDTH);
  });

  const header = keys
    .map((key, i) => {
      const width = columnWidths[i];
      return width === undefined ? key : key.padEnd(width);
    })
    .join("  ");
  console.log(header);
  console.log(columnWidths.map((w) => "-".repeat(w ?? 0)).join("  "));

  for (const row of data) {
    const line = keys
      .map((key, i) => {
        const value = String(row[key] ?? "");
        const width = columnWidths[i] ?? value.length;
        if (value.length > width) {
          const sliceEnd = Math.max(width - TRUNCATE_SUFFIX.length, 0);
          return `${value.slice(0, sliceEnd)}${TRUNCATE_SUFFIX}`;
        }
        return value.padEnd(width);
      })
      .join("  ");
    console.log(line);
  }
}

/** 键值对输出：对齐键列。 */
export function formatKeyValue(data: Record<string, unknown>): void {
  const keys = Object.keys(data);
  if (keys.length === 0) {
    console.log("(empty)");
    return;
  }

  const maxKeyLength = Math.max(...keys.map((key) => key.length));
  for (const [key, value] of Object.entries(data)) {
    console.log(`${key.padEnd(maxKeyLength)}: ${formatValue(value)}`);
  }
}

function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
