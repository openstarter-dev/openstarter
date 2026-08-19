import { sha256 } from "@openstarter/shared/hash";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { type ApiKeyRepository, createApiKeyService } from "./service";

interface StoredApiKey {
  createdAt: Date;
  deletedAt: Date | null;
  id: string;
  keyHash: string;
  keyPrefix: string;
  status: string;
  title: string;
  userId: string;
}

const createRepository = () => {
  const records: StoredApiKey[] = [];
  const repository: ApiKeyRepository = {
    findActiveUserIdByHash: (keyHash) =>
      Promise.resolve(
        records.find(
          (record) =>
            record.keyHash === keyHash && record.status === "active" && record.deletedAt === null,
        )?.userId ?? null,
      ),
    insert: (values) => {
      const record = {
        ...values,
        createdAt: new Date(0),
        deletedAt: null,
      };
      records.push(record);
      return Promise.resolve({ id: record.id, title: record.title });
    },
    listActive: ({ page, pageSize, search, userId }) => {
      const matching = records.filter(
        (record) =>
          record.userId === userId &&
          record.status === "active" &&
          record.deletedAt === null &&
          (search === undefined || record.title.includes(search)),
      );
      const start = (page - 1) * pageSize;
      return Promise.resolve({
        items: matching.slice(start, start + pageSize).map((record) => ({
          createdAt: record.createdAt,
          id: record.id,
          keyPrefix: record.keyPrefix,
          status: record.status,
          title: record.title,
        })),
        total: matching.length,
      });
    },
    revoke: ({ keyId, revokedAt, userId }) => {
      const record = records.find(
        (candidate) => candidate.id === keyId && candidate.userId === userId,
      );
      if (record) {
        record.status = "deleted";
        record.deletedAt = revokedAt;
      }
      return Promise.resolve();
    },
  };
  return { records, repository };
};

const FULL_KEY_PATTERN = /^sk_[A-Za-z0-9_-]{43}$/;
const nonEmptyString = fc.string({ maxLength: 64, minLength: 1 });

describe("API key service properties", () => {
  it("Feature: shipany-feature-parity, Property 13: API 密钥创建-校验-吊销往返", async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyString, nonEmptyString, async (userId, title) => {
        const { records, repository } = createRepository();
        const service = createApiKeyService(repository);
        const created = await service.createApiKey({ title, userId });
        const stored = records.at(0);

        expect(stored).toBeDefined();
        expect(FULL_KEY_PATTERN.test(created.key)).toBe(true);
        expect(stored?.keyHash === sha256(created.key)).toBe(true);
        expect(created.key.startsWith(stored?.keyPrefix ?? "")).toBe(true);
        expect(Object.values(stored ?? {}).includes(created.key)).toBe(false);
        await expect(service.validateApiKey(created.key)).resolves.toBe(userId);

        const replacement = created.key.endsWith("A") ? "B" : "A";
        const forgedKey = `${created.key.slice(0, -1)}${replacement}`;
        await expect(service.validateApiKey(forgedKey)).resolves.toBeNull();

        await service.revokeApiKey({ keyId: created.id, userId });
        await expect(service.validateApiKey(created.key)).resolves.toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
