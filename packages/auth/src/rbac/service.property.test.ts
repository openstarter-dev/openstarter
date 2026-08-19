import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { matchPermission } from "./matcher";
import {
  createPlatformAuthorizationService,
  type PlatformAuthorizationRepository,
  type PlatformPermissionGrant,
} from "./service";

const SEGMENT_PATTERN = /^[a-z][a-z0-9_-]{0,11}$/;
const segmentArbitrary = fc.stringMatching(SEGMENT_PATTERN);
const permissionCodeArbitrary = fc
  .tuple(segmentArbitrary, segmentArbitrary)
  .map(([resource, action]) => `${resource}.${action}`);
const platformGrantArbitrary = fc.oneof(
  permissionCodeArbitrary,
  segmentArbitrary.map((resource) => `${resource}.*`),
  fc.constant("*"),
);

const createRepository = (grants: PlatformPermissionGrant[]): PlatformAuthorizationRepository => ({
  listUserPermissionGrants: (_userId: string) => Promise.resolve(grants),
});

describe("platform authorization service properties", () => {
  it("exposes a deterministic repository and clock seam", () => {
    expect(createPlatformAuthorizationService).toBeTypeOf("function");
  });

  it("P12 expired roles contribute no permission", async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionCodeArbitrary,
        fc.integer({ max: 86_400_000, min: 1 }),
        async (permissionCode, elapsedMilliseconds) => {
          const now = new Date("2026-07-24T00:00:00.000Z");
          const service = createPlatformAuthorizationService({
            now: () => now,
            repository: createRepository([
              {
                code: permissionCode,
                expiresAt: new Date(now.getTime() - elapsedMilliseconds),
              },
            ]),
          });

          await expect(service.getPermissionCodes("user-1")).resolves.toEqual([]);
          await expect(service.hasPermission("user-1", permissionCode)).resolves.toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P55 platform authorization only uses wildcard RBAC and ignores organization grants", async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionCodeArbitrary,
        fc.array(platformGrantArbitrary, { maxLength: 8 }),
        fc.array(permissionCodeArbitrary, { maxLength: 8 }),
        async (requiredPermission, platformGrants, organizationGrants) => {
          const now = new Date("2026-07-24T00:00:00.000Z");
          const organizationRepository = {
            listOrganizationPermissionGrants: vi.fn(() =>
              Promise.resolve([requiredPermission, "*", ...organizationGrants]),
            ),
          };
          const options = {
            now: () => now,
            organizationRepository,
            repository: createRepository(platformGrants.map((code) => ({ code, expiresAt: null }))),
          };
          const service = createPlatformAuthorizationService(options);

          await expect(service.hasPermission("user-1", requiredPermission)).resolves.toBe(
            matchPermission(requiredPermission, platformGrants),
          );
          expect(organizationRepository.listOrganizationPermissionGrants).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
