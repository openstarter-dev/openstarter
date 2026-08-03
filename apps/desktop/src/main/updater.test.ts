import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { hasPublishConfig, shouldCheckForUpdates } from "./updater";

describe("shouldCheckForUpdates", () => {
  it("is true only when packaged, not disabled, and publish config exists", () => {
    expect(
      shouldCheckForUpdates({
        disabled: false,
        hasPublishConfig: true,
        isPackaged: true,
      })
    ).toBe(true);
  });

  it("is false when not packaged", () => {
    expect(
      shouldCheckForUpdates({
        disabled: false,
        hasPublishConfig: true,
        isPackaged: false,
      })
    ).toBe(false);
  });

  it("is false when explicitly disabled", () => {
    expect(
      shouldCheckForUpdates({
        disabled: true,
        hasPublishConfig: true,
        isPackaged: true,
      })
    ).toBe(false);
  });

  it("is false when no publish config is present", () => {
    expect(
      shouldCheckForUpdates({
        disabled: false,
        hasPublishConfig: false,
        isPackaged: true,
      })
    ).toBe(false);
  });

  it("is false when all three conditions fail", () => {
    expect(
      shouldCheckForUpdates({
        disabled: true,
        hasPublishConfig: false,
        isPackaged: false,
      })
    ).toBe(false);
  });
});

describe("hasPublishConfig", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { force: true, recursive: true });
    }
    dirs.length = 0;
  });

  it("returns false when app-update.yml does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-updater-"));
    dirs.push(dir);

    expect(hasPublishConfig(dir)).toBe(false);
  });

  it("returns true when app-update.yml exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-updater-"));
    dirs.push(dir);
    writeFileSync(join(dir, "app-update.yml"), "provider: github\n");

    expect(hasPublishConfig(dir)).toBe(true);
  });
});
