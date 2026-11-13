import { z } from "zod";

export const listSearchParams = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
});
export type ListSearch = z.infer<typeof listSearchParams>;

export const listUsersSearchParams = listSearchParams.extend({
  q: z
    .string()
    .catch("")
    .transform((value) => value.slice(0, 200))
    .default(""),
});
export type ListUsersSearch = z.infer<typeof listUsersSearchParams>;

export const LIST_PAGE_SIZE = 20;

export function countTotalPages(total: number, pageSize: number = LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
