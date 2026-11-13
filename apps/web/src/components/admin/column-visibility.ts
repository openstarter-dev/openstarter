import { createStore, useStore } from "@tanstack/react-store";

const STORAGE_KEY = "admin.table.column-visibility.v1";

export type ColumnVisibilityMap = Record<string, Record<string, boolean>>;

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

export function restoreColumnVisibility(tableKey: string): void {
  columnVisibilityStore.setState((prev) => {
    const saved = readPersisted()[tableKey];
    if (!saved) {
      return prev;
    }
    return { ...prev, [tableKey]: saved };
  });
}

export function setColumnVisibility(tableKey: string, visibility: Record<string, boolean>): void {
  columnVisibilityStore.setState((prev) => {
    const next = { ...prev, [tableKey]: visibility };
    const merged = { ...readPersisted(), [tableKey]: visibility };
    writePersisted(merged);
    return next;
  });
}

export function useColumnVisibility(tableKey: string): Record<string, boolean> {
  return useStore(columnVisibilityStore, (state) => state[tableKey] ?? EMPTY_VISIBILITY);
}
