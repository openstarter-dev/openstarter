import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function resolveFileUrl(url: string, baseDir: string): string {
  if (!url.startsWith("file:") || url.startsWith("file://")) {
    return url;
  }

  const pathPart = url.slice(5);
  if (pathPart.startsWith("/")) {
    return url;
  }

  const absolutePath = resolve(baseDir, pathPart);
  return pathToFileURL(absolutePath).href;
}
