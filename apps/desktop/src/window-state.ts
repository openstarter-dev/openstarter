// apps/desktop/src/window-state.ts —— 窗口尺寸位置的解析、校验、文件持久化。
//
// 不引入 electron-store，用 app.getPath("userData") 下的一个 JSON 文件即可（与仓库
// 既有的"零额外 dev 依赖"风格一致，见 spec §5）。单独成文件是因为"解析一个可能已损坏的
// JSON 状态文件"本身值得测——状态文件损坏导致启动崩溃是个真实故障模式。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface WindowState {
  height: number;
  width: number;
  x?: number;
  y?: number;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  height: 800,
  width: 1280,
};

const MIN_DIMENSION = 200;

function isValidDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_DIMENSION
  );
}

/** 解析一个候选窗口状态字符串；任何格式或取值问题都回退到默认值，不抛异常。 */
export function parseWindowState(raw: string): WindowState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_WINDOW_STATE };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_WINDOW_STATE };
  }

  const candidate = parsed as Record<string, unknown>;
  const width = isValidDimension(candidate.width)
    ? candidate.width
    : DEFAULT_WINDOW_STATE.width;
  const height = isValidDimension(candidate.height)
    ? candidate.height
    : DEFAULT_WINDOW_STATE.height;

  const state: WindowState = { height, width };

  if (typeof candidate.x === "number" && Number.isFinite(candidate.x)) {
    state.x = candidate.x;
  }
  if (typeof candidate.y === "number" && Number.isFinite(candidate.y)) {
    state.y = candidate.y;
  }

  return state;
}

/** 序列化窗口状态为可写入文件的 JSON 字符串。 */
export function serializeWindowState(state: WindowState): string {
  return JSON.stringify(state);
}

export interface WindowStateStore {
  read: () => WindowState;
  write: (state: WindowState) => void;
}

/** 基于单个 JSON 文件的窗口状态存取。读取时任何异常（文件不存在/损坏）都回退到默认值。 */
export function createFileWindowStateStore(filePath: string): WindowStateStore {
  return {
    read: () => {
      if (!existsSync(filePath)) {
        return { ...DEFAULT_WINDOW_STATE };
      }
      try {
        return parseWindowState(readFileSync(filePath, "utf8"));
      } catch {
        return { ...DEFAULT_WINDOW_STATE };
      }
    },
    write: (state) => {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, serializeWindowState(state));
    },
  };
}
