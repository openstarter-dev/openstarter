import { buildConfigFor, loadWebEnv, resolveDbUrl } from "./src/config/drizzle.shared";

loadWebEnv();

// Local dev falls back to the sqlite file at the repo root when DATABASE_URL is unset
// or not a file: URL (mirrors createD1Db's local resolution).
const envUrl = process.env.DATABASE_URL;
const localUrl = envUrl?.startsWith("file:") ? envUrl : "file:local.db";

export default buildConfigFor(resolveDbUrl(localUrl));
