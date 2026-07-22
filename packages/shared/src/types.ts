// @openstarter/shared/types 跨能力域共享的通用 TypeScript 类型与常量。
// 这些类型/常量被多个能力域（api 各域列表端点、billing、content 等）复用，
// 与响应封装（resp.ts）互补：请求侧的分页/排序入参在此声明，响应侧信封在 resp.ts。

/**
 * 列表排序方向。以 `as const` 对象 + 同名联合类型表达（遵循 ultracite：不使用 enum）。
 */
export const SortOrder = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

/**
 * 分页查询入参：被各能力域的列表端点复用（与 resp.ts 的 respPage/PageData 配对）。
 */
export type PaginationParams = {
  page: number;
  pageSize: number;
};
