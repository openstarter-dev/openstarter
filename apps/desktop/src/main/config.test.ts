import { describe, expect, it } from "vitest";

import { getDesktopMode, isUpdaterDisabled } from "./config";

describe("getDesktopMode", () => {
  it("returns dev when not packaged", () => {
    expect(getDesktopMode(false)).toBe("dev");
  });

  it("returns prod when packaged", () => {
    expect(getDesktopMode(true)).toBe("prod");
  });
});

describe("isUpdaterDisabled", () => {
  it("is false when the env var is unset", () => {
    expect(isUpdaterDisabled({})).toBe(false);
  });

  it("is true when the env var is 'true'", () => {
    expect(isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "true" })).toBe(true);
  });

  it("is false for any other value", () => {
    expect(isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "false" })).toBe(false);
    expect(isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "1" })).toBe(false);
  });
});
