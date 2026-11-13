const CATEGORY_DELIMITERS = /[,;]/;

export function parseCategories(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return [];
  }
  if (trimmed.startsWith("[")) {
    const parsed = parseJsonArray(trimmed);
    if (parsed) {
      return parsed;
    }
  }
  return trimmed
    .split(CATEGORY_DELIMITERS)
    .map((token) => token.trim())
    .filter((token) => token !== "");
}

function parseJsonArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  } catch {
    return null;
  }
}

export function collectCategories(items: ReadonlyArray<{ categories?: string | null }>): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    for (const category of parseCategories(item.categories)) {
      seen.add(category);
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
