import { buildConfigFor, loadWebEnv, resolveDbUrl } from "./src/config/drizzle.shared";


loadWebEnv();

const provider = process.env.DATABASE_PROVIDER?.trim() || "d1";

const config = (() => {
  if (provider === "postgres") {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "DATABASE_URL is required when DATABASE_PROVIDER=postgres (set it in apps/web/.env).",
      );
    }
    return buildConfigFor("postgresql", resolveDbUrl(url));
  }

  if (provider === "d1") {
    const envUrl = process.env.DATABASE_URL;
    const localUrl = envUrl?.startsWith("file:") ? envUrl : "file:local.db";
    return buildConfigFor("sqlite", resolveDbUrl(localUrl));
  }

  throw new Error(
    `Unsupported DATABASE_PROVIDER for local drizzle-kit: ${provider}. Expected one of: postgres, d1.`,
  );
})();

export default config;
