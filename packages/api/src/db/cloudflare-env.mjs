export async function tryGetCloudflareEnv() {
  try {
    if (import.meta.env?.DEV) {
      return (await import("cloudflare:workers")).env;
    }
    const specifier = "cloudflare" + ":workers";
    return (await import(specifier)).env;
  } catch {
    return undefined;
  }
}
