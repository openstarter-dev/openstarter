import { z } from "zod";

export const idParam = z.object({ id: z.string().min(1) });

export function createPaginationSchema(maxPageSize: number = 100, defaultPageSize: number = 20) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  });
}

export const paginationSchema = createPaginationSchema();
