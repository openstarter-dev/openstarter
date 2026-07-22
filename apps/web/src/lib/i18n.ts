// Locale-aware message helpers built on the Paraglide runtime that the vite
// plugin compiles into src/paraglide from the shared packages/i18n catalog.
//
// Prefer static access — `m["ns.key"]()` — wherever the key is known at author
// time: it lets Paraglide tree-shake unused messages. Use tDynamic only for
// keys assembled at runtime (e.g. a label derived from a data value).
// Requirements: 23.2.

import { m } from "@/paraglide/messages.js";

// A compiled message accessor: called with no inputs for parameter-free keys.
type MessageResolver = (() => string) | undefined;

/**
 * Resolve a translation key built at runtime to its localized string.
 *
 * Falls back to the key itself when no message matches, so an unknown or
 * not-yet-translated key degrades gracefully instead of throwing.
 *
 * @param key Fully-qualified message key (e.g. `common.nav.theme_dark`).
 * @returns The localized string, or the key when it is not a known message.
 */
export function tDynamic(key: string): string {
  const bundle = m as unknown as Record<string, MessageResolver>;
  const resolve = bundle[key];
  return typeof resolve === "function" ? resolve() : key;
}
