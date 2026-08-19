import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createFileWindowStateStore,
  DEFAULT_WINDOW_STATE,
  parseWindowState,
  serializeWindowState,
} from "./window-state";

describe("parseWindowState", () => {
  it("parses a valid state", () => {
    const state = parseWindowState(JSON.stringify({ height: 900, width: 1400, x: 10, y: 20 }));

    expect(state).toEqual({ height: 900, width: 1400, x: 10, y: 20 });
  });

  it("parses a valid state without position", () => {
    const state = parseWindowState(JSON.stringify({ height: 900, width: 1400 }));

    expect(state).toEqual({ height: 900, width: 1400 });
  });

  it("falls back to the default on malformed JSON", () => {
    expect(parseWindowState("{not json")).toEqual(DEFAULT_WINDOW_STATE);
  });

  it("falls back to the default on a JSON array", () => {
    expect(parseWindowState("[1, 2, 3]")).toEqual(DEFAULT_WINDOW_STATE);
  });

  it("falls back to the default when width is below the minimum", () => {
    const state = parseWindowState(JSON.stringify({ height: 900, width: 10 }));

    expect(state.width).toBe(DEFAULT_WINDOW_STATE.width);
    expect(state.height).toBe(900);
  });

  it("falls back to the default when height is not a number", () => {
    const state = parseWindowState(JSON.stringify({ height: "tall", width: 1400 }));

    expect(state.height).toBe(DEFAULT_WINDOW_STATE.height);
    expect(state.width).toBe(1400);
  });

  it("drops a non-finite x/y instead of failing the whole state", () => {
    const state = parseWindowState(
      JSON.stringify({ height: 900, width: 1400, x: Number.POSITIVE_INFINITY }),
    );

    expect(state).toEqual({ height: 900, width: 1400 });
  });
});

describe("serializeWindowState / parseWindowState round-trip", () => {
  it("round-trips a full state", () => {
    const original = { height: 768, width: 1024, x: 5, y: 5 };

    expect(parseWindowState(serializeWindowState(original))).toEqual(original);
  });
});

describe("createFileWindowStateStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { force: true, recursive: true });
    }
    dirs.length = 0;
  });

  it("read() returns the default when the file does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-window-state-"));
    dirs.push(dir);
    const store = createFileWindowStateStore(join(dir, "window-state.json"));

    expect(store.read()).toEqual(DEFAULT_WINDOW_STATE);
  });

  it("write() then read() round-trips through the filesystem", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-window-state-"));
    dirs.push(dir);
    const store = createFileWindowStateStore(join(dir, "window-state.json"));

    store.write({ height: 700, width: 1500, x: 1, y: 2 });

    expect(store.read()).toEqual({ height: 700, width: 1500, x: 1, y: 2 });
  });

  it("read() returns the default when the file contains corrupted JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-window-state-"));
    dirs.push(dir);
    const filePath = join(dir, "window-state.json");
    const store = createFileWindowStateStore(filePath);
    store.write({ height: 700, width: 1500 });

    // 模拟文件被破坏（例如进程在写入过程中被杀死）。
    writeFileSync(filePath, "{corrupted");

    expect(store.read()).toEqual(DEFAULT_WINDOW_STATE);
  });
});
