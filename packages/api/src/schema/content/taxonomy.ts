import { z } from "zod";

import { createPaginationSchema } from "../shared";

export const TaxonomyStatus = {
  PUBLISHED: "published",
  PENDING: "pending",
  DRAFT: "draft",
  ARCHIVED: "archived",
} as const;

export type TaxonomyStatus = (typeof TaxonomyStatus)[keyof typeof TaxonomyStatus];

export const TAXONOMY_STATUS_VALUES = [
  TaxonomyStatus.PUBLISHED,
  TaxonomyStatus.PENDING,
  TaxonomyStatus.DRAFT,
  TaxonomyStatus.ARCHIVED,
] as const;


export const listQuery = createPaginationSchema(100, 50).extend({
  type: z.string().min(1).optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
  parentId: z.string().min(1).optional(),
});

export const createBody = z.object({
  slug: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().min(1).optional(),
  sort: z.number().int().optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
});

export const updateBody = z.object({
  slug: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sort: z.number().int().optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
});
