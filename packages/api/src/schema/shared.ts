// Shared/common schemas used across multiple modules
import { z } from "zod";

// Standard ID parameter schema (used in /resource/:id routes)
export const idParam = z.object({ id: z.string().min(1) });

// Pagination helper: creates a listQuery schema with customizable defaults
export function createPaginationSchema(maxPageSize: number = 100, defaultPageSize: number = 20) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  });
}

// Default pagination schema (100 max, 20 default) - most common usage
export const paginationSchema = createPaginationSchema();
