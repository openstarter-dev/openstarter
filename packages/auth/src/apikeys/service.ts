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
import { db } from "@openstarter/db/server";
import { sha256 } from "@openstarter/shared/hash";
import { getUuid } from "@openstarter/shared/id";
import { and, count, eq, isNull, like } from "drizzle-orm";

const KEY_PREFIX = "sk_";
// 前缀中保留的随机字符数，供用户在列表 UI 中识别密钥（不足以还原明文）。
const KEY_PREVIEW_LENGTH = 8;
const KEY_RANDOM_BYTES = 32;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/** 生成明文密钥、其 sha256 哈希与展示前缀。 */
function generateKey(): { key: string; keyHash: string; keyPrefix: string } {
  // 32 字节随机 → base64url（约 43 字符），加字面前缀 "sk_"。
  const rand = randomBytes(KEY_RANDOM_BYTES).toString("base64url");
  const key = `${KEY_PREFIX}${rand}`;
  return {
    key,
    keyHash: sha256(key),
    keyPrefix: `${KEY_PREFIX}${rand.slice(0, KEY_PREVIEW_LENGTH)}`,
  };
}

/** API 密钥列表项（仅前缀，不含明文/哈希）。 */
export interface ApiKeyListItem {
  id: string;
  keyPrefix: string;
  title: string;
  status: string;
  createdAt: Date;
}

/**
 * 为用户创建 API 密钥。明文 `key` **仅此一次**返回（不落库，仅存哈希）。R8.1
 */
export async function createApiKey(params: {
  userId: string;
  title: string;
}): Promise<{ id: string; key: string; title: string }> {
  const { userId, title } = params;
  const { key, keyHash, keyPrefix } = generateKey();

  const [row] = await db()
    .insert(apikey)
    .values({
      id: getUuid(),
      userId,
      keyHash,
      keyPrefix,
      title,
      status: "active",
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create API key");
  }

  return { id: row.id, key, title: row.title };
}

/**
 * 分页列出用户的有效 API 密钥，可按标题模糊搜索。仅返回前缀。R8.4
 */
export async function listApiKeys(
  userId: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  search?: string
): Promise<{ items: ApiKeyListItem[]; total: number }> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));

  const conditions = [
    eq(apikey.userId, userId),
    eq(apikey.status, "active"),
    isNull(apikey.deletedAt),
  ];
  if (search) {
    conditions.push(like(apikey.title, `%${search}%`));
  }
  const where = and(...conditions);

  const database = db();
  const [totalResult] = await database
    .select({ count: count() })
    .from(apikey)
    .where(where);

  const items = await database
    .select({
      id: apikey.id,
      keyPrefix: apikey.keyPrefix,
      title: apikey.title,
      status: apikey.status,
      createdAt: apikey.createdAt,
    })
    .from(apikey)
    .where(where)
    .limit(safePageSize)
    .offset((safePage - 1) * safePageSize);

  return { items, total: totalResult?.count ?? 0 };
}

/**
 * 软删除（吊销）一个 API 密钥。仅限所属用户操作。R8.3
 */
export async function revokeApiKey(params: {
  userId: string;
  keyId: string;
}): Promise<void> {
  const { userId, keyId } = params;
  await db()
    .update(apikey)
    .set({ status: "deleted", deletedAt: new Date() })
    .where(and(eq(apikey.id, keyId), eq(apikey.userId, userId)));
}

/**
 * 校验 API 密钥。有效则返回所属 userId，否则返回 null。R8.2/R8.5
 *
 * 按 `sha256(明文)` 查询 `active` 且未软删的记录；不存在或已吊销均返回 null。
 */
export async function validateApiKey(key: string): Promise<string | null> {
  if (!key) {
    return null;
  }
  const keyHash = sha256(key);
  const [row] = await db()
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
}
