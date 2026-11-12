import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  columnVisibilityStore,
  restoreColumnVisibility,
  setColumnVisibility,
  useColumnVisibility,
} from "./column-visibility";

const STORAGE_KEY = "admin.table.column-visibility.v1";

beforeEach(() => {
  columnVisibilityStore.setState(() => ({}));
  localStorage.clear();
});

describe("columnVisibilityStore", () => {
  it("returns an empty map for a table without a saved preference", () => {
    const { result } = renderHook(() => useColumnVisibility("orders"));
    expect(result.current).toEqual({});
  });

  it("updates the shared store and persists to localStorage", () => {
    act(() => setColumnVisibility("orders", { status: false }));

    expect(columnVisibilityStore.state.orders).toEqual({ status: false });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ orders: { status: false } });
  });

  it("restores a persisted preference back into the store", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ users: { email: false } }));

    act(() => restoreColumnVisibility("users"));

    expect(columnVisibilityStore.state.users).toEqual({ email: false });
  });

  it("leaves other tables untouched when restoring one table", () => {
    act(() => setColumnVisibility("orders", { status: false }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ users: { email: false } }));

    act(() => restoreColumnVisibility("users"));

    expect(columnVisibilityStore.state.orders).toEqual({ status: false });
    expect(columnVisibilityStore.state.users).toEqual({ email: false });
  });
});
