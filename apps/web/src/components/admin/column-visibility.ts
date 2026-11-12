import { createStore, useStore } from "@tanstack/react-store";

const STORAGE_KEY = "admin.table.column-visibility.v1";

export type ColumnVisibilityMap = Record<string, Record<string, boolean>>;

/** selector 的稳定默认值：未设置偏好的表默认全列可见。 */
const EMPTY_VISIBILITY: Record<string, boolean> = {};

export const columnVisibilityStore = createStore<ColumnVisibilityMap>({});

function readPersisted(): ColumnVisibilityMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ColumnVisibilityMap) : {};
  } catch {
    return {};
  }
}

function writePersisted(map: ColumnVisibilityMap): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}

/** 把某张表的持久化偏好恢复到 store（在客户端 mount 后调用一次）。 */
export function restoreColumnVisibility(tableKey: string): void {
  columnVisibilityStore.setState((prev) => {
    const saved = readPersisted()[tableKey];
    if (!saved) {
      return prev;
    }
    return { ...prev, [tableKey]: saved };
  });
}

/**
 * 更新某张表的列可见性（不可变更新）。写 localStorage 时以「已持久化的全量 map」
 * 为基底合并顶层 key，避免覆盖其他表（含其他浏览器标签页已写入）的偏好（M2）。
 */
export function setColumnVisibility(tableKey: string, visibility: Record<string, boolean>): void {
  columnVisibilityStore.setState((prev) => {
    const next = { ...prev, [tableKey]: visibility };
    const merged = { ...readPersisted(), [tableKey]: visibility };
    writePersisted(merged);
    return next;
  });
}

/** 订阅某张表当前的列可见性；未设置时返回全可见默认值。 */
export function useColumnVisibility(tableKey: string): Record<string, boolean> {
  return useStore(columnVisibilityStore, (state) => state[tableKey] ?? EMPTY_VISIBILITY);
}
