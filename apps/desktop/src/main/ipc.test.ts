// apps/desktop/src/main/ipc.test.ts —— 测试 IPC 模块的纯逻辑部分
// 注意：ipcMain.handle 的注册需要 Electron 运行时，这里只测试纯函数
// readSettings / writeSettings 是纯逻辑

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readSettings, writeSettings } from "./ipc";

describe("readSettings", () => {
  it("returns default settings when no file exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "ipc-test-"));
    const settings = readSettings(dir);
    expect(settings).toEqual({
      launchOnStart: true,
      minimizeToTray: true,
      autoStart: false,
      theme: "system",
      shortcuts: {},
    });
    rmSync(dir, { force: true, recursive: true });
  });

  it("merges saved settings with defaults", () => {
    const dir = mkdtempSync(join(tmpdir(), "ipc-test-"));
    const filePath = join(dir, "settings.json");
    writeFileSync(filePath, JSON.stringify({ theme: "dark" }));

    const settings = readSettings(dir);
    expect(settings.theme).toBe("dark");
    expect(settings.launchOnStart).toBe(true); // default
    expect(settings.minimizeToTray).toBe(true); // default

    rmSync(dir, { force: true, recursive: true });
  });

  it("returns defaults on corrupted JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "ipc-test-"));
    const filePath = join(dir, "settings.json");
    writeFileSync(filePath, "{corrupted");

    const settings = readSettings(dir);
    expect(settings.theme).toBe("system");

    rmSync(dir, { force: true, recursive: true });
  });
});

describe("writeSettings", () => {
  it("writes and reads back settings", () => {
    const dir = mkdtempSync(join(tmpdir(), "ipc-test-"));
    const result = writeSettings({ theme: "dark", autoStart: true }, dir);
    expect(result.theme).toBe("dark");
    expect(result.autoStart).toBe(true);

    // 读回确认
    const readBack = readSettings(dir);
    expect(readBack.theme).toBe("dark");
    expect(readBack.autoStart).toBe(true);

    rmSync(dir, { force: true, recursive: true });
  });

  it("merges partial updates", () => {
    const dir = mkdtempSync(join(tmpdir(), "ipc-test-"));
    writeSettings({ theme: "dark" }, dir);
    writeSettings({ autoStart: true }, dir);

    const readBack = readSettings(dir);
    expect(readBack.theme).toBe("dark");
    expect(readBack.autoStart).toBe(true);
    expect(readBack.minimizeToTray).toBe(true); // default

    rmSync(dir, { force: true, recursive: true });
  });
});