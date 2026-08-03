import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it } from "vitest";

import { buildMenuTemplate } from "./menu";

function collectRoles(items: MenuItemConstructorOptions[]): string[] {
  const roles: string[] = [];
  for (const item of items) {
    if (typeof item.role === "string") {
      roles.push(item.role);
    }
    if (Array.isArray(item.submenu)) {
      roles.push(...collectRoles(item.submenu as MenuItemConstructorOptions[]));
    }
  }
  return roles;
}

describe("buildMenuTemplate", () => {
  it("includes the clipboard roles required for Cmd/Ctrl+C/V/A to work", () => {
    const roles = collectRoles(buildMenuTemplate(false));

    expect(roles).toContain("copy");
    expect(roles).toContain("paste");
    expect(roles).toContain("selectAll");
    expect(roles).toContain("cut");
    expect(roles).toContain("undo");
    expect(roles).toContain("redo");
  });

  it("includes the clipboard roles on macOS too", () => {
    const roles = collectRoles(buildMenuTemplate(true));

    expect(roles).toContain("copy");
    expect(roles).toContain("paste");
    expect(roles).toContain("selectAll");
  });

  it("adds a macOS app menu (about/hide/quit) only when isMac is true", () => {
    const macRoles = collectRoles(buildMenuTemplate(true));
    const otherRoles = collectRoles(buildMenuTemplate(false));

    expect(macRoles).toContain("about");
    expect(macRoles).toContain("hide");
    expect(otherRoles).not.toContain("hide");
  });

  it("always provides a way to quit", () => {
    const macRoles = collectRoles(buildMenuTemplate(true));
    const otherRoles = collectRoles(buildMenuTemplate(false));

    expect(macRoles).toContain("quit");
    expect(otherRoles).toContain("quit");
  });
});
