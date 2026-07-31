// packages/auth/src/apikeys/service —— API 密钥服务（R8）。
//
// 安全约束（对齐 ShipAny `modules/apikeys`）：
//   - 明文密钥形如 `sk_ + base64url(32 字节 CSPRNG)`，**仅在创建响应中一次性返回**；
//   - 存储侧只保留 `sha256(明文)` 哈希与可展示前缀 `sk_ + 前 8 位`，绝不持久化明文；
//   - 校验按哈希查 `active` 且未软删的记录 → 关联所属 userId；
//   - 吊销为软删除（`status=deleted` + `deletedAt`），使后续校验必然失败；
//   - 列表仅返回前缀，绝不暴露完整密钥。

import { randomBytes } from "node:crypto";

import { apikey } from "@openstarter/db/schema";
import { type Database, db } from "@openstarter/db/server";
import { sha256 } from "@openstarter/shared/hash";
import { getUuid } from "@openstarter/shared/id";
import { and, count, eq, isNull, like } from "drizzle-orm";

const KEY_PREFIX = "sk_";
const KEY_PREVIEW_LENGTH = 8;
const KEY_RANDOM_BYTES = 32;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

interface GeneratedKey {
  key: string;
  keyHash: string;
  keyPrefix: string;
}

export interface ApiKeyListItem {
  createdAt: Date;
  id: string;
  keyPrefix: string;
  status: string;
  title: string;
}

export interface ApiKeyInsertValues {
  id: string;
  keyHash: string;
  keyPrefix: string;
  status: "active";
  title: string;
  userId: string;
}

export interface ApiKeyListParams {
  page: number;
  pageSize: number;
  search?: string;
  userId: string;
}

export interface ApiKeyRepository {
  findActiveUserIdByHash: (keyHash: string) => Promise<string | null>;
  insert: (
    values: ApiKeyInsertValues
  ) => Promise<{ id: string; title: string } | null>;
  listActive: (
    params: ApiKeyListParams
  ) => Promise<{ items: ApiKeyListItem[]; total: number }>;
  revoke: (params: {
    keyId: string;
    revokedAt: Date;
    userId: string;
  }) => Promise<void>;
}

function generateKey(): GeneratedKey {
  const random = randomBytes(KEY_RANDOM_BYTES).toString("base64url");
  const key = `${KEY_PREFIX}${random}`;
  return {
    key,
    keyHash: sha256(key),
    keyPrefix: `${KEY_PREFIX}${random.slice(0, KEY_PREVIEW_LENGTH)}`,
  };
}

export function createApiKeyService(repository: ApiKeyRepository) {
  const createApiKey = async (params: { userId: string; title: string }) => {
    const { userId, title } = params;
    const { key, keyHash, keyPrefix } = generateKey();
    const row = await repository.insert({
      id: getUuid(),
      keyHash,
      keyPrefix,
      status: "active",
      title,
      userId,
    });

    if (!row) {
      throw new Error("Failed to create API key");
    }

    return { id: row.id, key, title: row.title };
  };

  const listApiKeys = async (
    userId: string,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    search?: string
  ) => {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    return await repository.listActive({
      page: safePage,
      pageSize: safePageSize,
      search: search || undefined,
      userId,
    });
  };

  const revokeApiKey = async (params: { userId: string; keyId: string }) => {
    await repository.revoke({ ...params, revokedAt: new Date() });
  };

  const validateApiKey = async (key: string) => {
    if (!key) {
      return null;
    }
    return await repository.findActiveUserIdByHash(sha256(key));
  };

  return { createApiKey, listApiKeys, revokeApiKey, validateApiKey };
}

export const createDatabaseApiKeyRepository = (
  getDatabase: () => Database = db
): ApiKeyRepository => ({
  findActiveUserIdByHash: async (keyHash) => {
    const [row] = await getDatabase()
      .select({ userId: apikey.userId })
      .from(apikey)
      .where(
        and(
          eq(apikey.keyHash, keyHash),
          eq(apikey.status, "active"),
          isNull(apikey.deletedAt)
        )
      )
      .limit(1);
    return row?.userId ?? null;
  },
  insert: async (values) => {
    const [row] = await getDatabase().insert(apikey).values(values).returning();
    if (!row) {
      return null;
    }
    return { id: row.id, title: row.title };
  },
  listActive: async ({ page, pageSize, search, userId }) => {
    const conditions = [
      eq(apikey.userId, userId),
      eq(apikey.status, "active"),
      isNull(apikey.deletedAt),
    ];
    if (search) {
      conditions.push(like(apikey.title, `%${search}%`));
    }
    const where = and(...conditions);
    const database = getDatabase();
    const [totalResult] = await database
      .select({ count: count() })
      .from(apikey)
      .where(where);
    const items = await database
      .select({
        createdAt: apikey.createdAt,
        id: apikey.id,
        keyPrefix: apikey.keyPrefix,
        status: apikey.status,
        title: apikey.title,
      })
      .from(apikey)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { items, total: totalResult?.count ?? 0 };
  },
  revoke: async ({ keyId, revokedAt, userId }) => {
    await getDatabase()
      .update(apikey)
      .set({ deletedAt: revokedAt, status: "deleted" })
      .where(and(eq(apikey.id, keyId), eq(apikey.userId, userId)));
  },
});

const databaseApiKeyRepository = createDatabaseApiKeyRepository();

export const { createApiKey, listApiKeys, revokeApiKey, validateApiKey } =
  createApiKeyService(databaseApiKeyRepository);
