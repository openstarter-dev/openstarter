// Centralized Zod schemas for the API module
//
// Organizes shared/common schemas by domain. Domain-specific schemas may
// optionally live here too, but the primary goal is to eliminate duplication
// of pagination, id param, and other common patterns across routers.

export { idParam, paginationSchema, createPaginationSchema } from "./shared";
