import { env } from "./env";

export type AuthAdapterProvider = "pg" | "mysql" | "sqlite";

export function getAuthAdapterProvider(provider = env.DATABASE_PROVIDER): AuthAdapterProvider {
  switch (provider) {
    case "postgres":
      return "pg";
    case "d1":
      return "sqlite";
    default:
      throw new Error(`Unsupported DATABASE_PROVIDER: ${provider}`);
  }
}
