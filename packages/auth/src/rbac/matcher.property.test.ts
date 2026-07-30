import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { matchPermission } from "./matcher";

const SEGMENT_PATTERN = /^[a-z][a-z0-9_-]{0,11}$/;
const segmentArbitrary = fc.stringMatching(SEGMENT_PATTERN);
const resourceArbitrary = fc
  .array(segmentArbitrary, { maxLength: 3, minLength: 1 })
  .map((segments) => segments.join("."));
const permissionCodeArbitrary = fc
  .tuple(resourceArbitrary, segmentArbitrary)
  .map(([resource, action]) => `${resource}.${action}`);
const unrelatedResourcePairArbitrary = fc
  .tuple(resourceArbitrary, resourceArbitrary)
  .filter(
    ([grantedResource, requiredResource]) =>
      requiredResource !== grantedResource &&
      !requiredResource.startsWith(`${grantedResource}.`)
  );

describe("platform RBAC wildcard matcher properties", () => {
  it("P10 resource.* grants every permission below that resource prefix", () => {
    fc.assert(
      fc.property(
        resourceArbitrary,
        segmentArbitrary,
        fc.array(segmentArbitrary, { maxLength: 3, minLength: 0 }),
        (resource, action, descendants) => {
          const suffix = [...descendants, action].join(".");
          const requiredPermission = `${resource}.${suffix}`;

          expect(matchPermission(requiredPermission, [`${resource}.*`])).toBe(
            true
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("P10 resource.* does not grant permissions outside that resource prefix", () => {
    fc.assert(
      fc.property(
        unrelatedResourcePairArbitrary,
        segmentArbitrary,
        ([grantedResource, requiredResource], action) => {
          const requiredPermission = `${requiredResource}.${action}`;

          expect(
            matchPermission(requiredPermission, [`${grantedResource}.*`])
          ).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("P11 global * grants every concrete permission", () => {
    fc.assert(
      fc.property(permissionCodeArbitrary, (requiredPermission) => {
        expect(matchPermission(requiredPermission, ["*"])).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
