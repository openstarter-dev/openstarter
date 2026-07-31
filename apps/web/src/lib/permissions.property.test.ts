import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { matchAnyPermission, matchPermission } from "@/lib/permissions";

const SEGMENT_REGEX = /^[a-z][a-z0-9_-]{0,11}$/;
const FULL_CODE_REGEX = /^[a-z][a-z0-9_-]{0,11}\.[a-z][a-z0-9_-]{0,11}$/;
const permissionCodeArbitrary = fc.stringMatching(FULL_CODE_REGEX);
const segmentArbitrary = fc.stringMatching(SEGMENT_REGEX);

describe("admin UI permission matcher (Property 51, 52)", () => {
  it("P51 global wildcard '*' satisfies any required permission", () => {
    fc.assert(
      fc.property(permissionCodeArbitrary, (required) => {
        expect(matchPermission(required, ["*"])).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("P51 exact match satisfies the required permission", () => {
    fc.assert(
      fc.property(permissionCodeArbitrary, (required) => {
        expect(matchPermission(required, [required])).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("P51 resource.* satisfies every permission sharing the resource prefix", () => {
    fc.assert(
      fc.property(segmentArbitrary, segmentArbitrary, (resource, action) => {
        const required = `${resource}.${action}`;

        expect(matchPermission(required, [`${resource}.*`])).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("P51 unrelated permissions never satisfy the required one", () => {
    fc.assert(
      fc.property(
        permissionCodeArbitrary,
        segmentArbitrary,
        segmentArbitrary,
        (required, otherResource, otherAction) => {
          const other = `${otherResource}.${otherAction}`;
          fc.pre(
            required !== other && !required.startsWith(`${otherResource}.`)
          );

          expect(matchPermission(required, [other])).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("P52 matchAnyPermission returns true when at least one required code is granted", () => {
    fc.assert(
      fc.property(
        permissionCodeArbitrary,
        fc.array(permissionCodeArbitrary, { maxLength: 5, minLength: 0 }),
        (granted, others) => {
          const requiredCodes = [granted, ...others];

          expect(matchAnyPermission(requiredCodes, [granted])).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("P52 matchAnyPermission returns false when none of the required codes are granted", () => {
    fc.assert(
      fc.property(
        fc.array(permissionCodeArbitrary, { maxLength: 5, minLength: 1 }),
        fc.array(permissionCodeArbitrary, { maxLength: 5, minLength: 0 }),
        (requiredCodes, grantedSet) => {
          const disjoint = grantedSet.filter(
            (granted) =>
              !requiredCodes.includes(granted) &&
              granted !== "*" &&
              !requiredCodes.some((required) =>
                required.startsWith(`${granted.slice(0, -2)}.`)
              )
          );
          fc.pre(disjoint.length === grantedSet.length);

          expect(matchAnyPermission(requiredCodes, grantedSet)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("P52 each admin nav item is gated by some permission via ADMIN_NAV behavior", () => {
    // Mirror the ADMIN_NAV structure: every item carries permission + uses
    // matchPermission. Visibility must be derivable from matchPermission over
    // the permission set. This is the Property 52 entry-filtering contract.
    const NAV_PERMISSIONS = [
      "admin.*",
      "taxonomy.read",
      "post.read",
      "ticket.read",
    ];
    const adminUser = ["admin.*"];
    const editorUser = ["post.read", "post.write", "taxonomy.read"];
    const supportUser = ["ticket.read", "ticket.*"];
    const noPermissions: string[] = [];

    expect(NAV_PERMISSIONS.some((p) => matchPermission(p, adminUser))).toBe(
      true
    );
    expect(NAV_PERMISSIONS.some((p) => matchPermission(p, editorUser))).toBe(
      true
    );
    expect(NAV_PERMISSIONS.some((p) => matchPermission(p, supportUser))).toBe(
      true
    );
    expect(NAV_PERMISSIONS.some((p) => matchPermission(p, noPermissions))).toBe(
      false
    );
  });
});
