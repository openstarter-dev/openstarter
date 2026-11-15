import { loadWebEnv } from "./drizzle.shared";

loadWebEnv();

// drizzle-kit is only used for SQL generation (db:generate); applying migrations
// happens via wrangler d1 migrations apply (local) and d1-http (prod).
// drizzle-kit 只负责生成 SQL（db:generate）；迁移应用走 wrangler（本地）与 d1-http（生产）。
export default {
  schema: "./src/schema/index.ts",
  out: "./src/migrations/sqlite",
  dialect: "sqlite",
};
