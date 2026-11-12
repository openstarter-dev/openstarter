import { z } from "zod";

/**
 * 通用分页 search schema。
 * `page`：`?page=N`；缺省 / 脏输入（0、负数、非数字）经 `.catch(1)` 回落 1，
 * 保证任何 URL 都不会让 loader 抛错。
 */
export const listSearchParams = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
});
export type ListSearch = z.infer<typeof listSearchParams>;

/** 分页 + 邮箱搜索（admin users）。空搜索不落进 URL（q 省略），保持链接干净。 */
export const listUsersSearchParams = listSearchParams.extend({
  q: z
    .string()
    .catch("")
    .transform((value) => value.slice(0, 200))
    .default(""),
});
export type ListUsersSearch = z.infer<typeof listUsersSearchParams>;

/** 每页条数（与后端 pagination 默认对齐；admin/user 列表共用）。 */
export const LIST_PAGE_SIZE = 20;

/** totalPages 计算：total=0 时至少 1 页（分页器不出现 0/0）。 */
export function countTotalPages(total: number, pageSize: number = LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
