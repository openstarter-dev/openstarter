/**
 * Resolve a relative `file:` URL against a base directory.
 *
 * Shared by the drizzle-kit configs so a relative `DATABASE_URL=file:local.db`
 * always lands on the same database file regardless of which working directory
 * triggers the resolution. Non-file URLs (postgres://, libsql://, absolute
 * `file:` URLs) pass through untouched.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Resolve a relative `file:` URL against `baseDir`. Absolute-path `file:` URLs
 * (`file:/…`), `file://` URLs and non-`file:` URLs are returned unchanged.
 */
export function resolveFileUrl(url: string, baseDir: string): string {
  if (!url.startsWith("file:") || url.startsWith("file://")) {
    return url;
  }

  const pathPart = url.slice(5); // Remove "file:" prefix
  if (pathPart.startsWith("/")) {
    // Absolute path, return as-is
    return url;
  }

  // Relative path — resolve against the given base directory
  const absolutePath = resolve(baseDir, pathPart);
  return pathToFileURL(absolutePath).href;
}
