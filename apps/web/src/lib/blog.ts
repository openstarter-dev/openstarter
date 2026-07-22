// 博客展示辅助（客户端安全）。
//
// 仅用于从已加载文章的 `categories` 文本派生**展示用**分类筛选入口（chips）。
// 分类筛选的**权威归属判定**在服务端（packages/api 的 Blog_Module，Property 35）；
// 此处的解析仅服务于 UI，且与服务端保持相同的格式约定（JSON 数组或逗号/分号分隔）。

const CATEGORY_DELIMITERS = /[,;]/;

/** 解析 `categories` 文本为分类词元（兼容 JSON 数组与逗号/分号分隔）。 */
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

/** 汇总一组文章中出现的全部分类（去重、按名称升序），用于渲染筛选入口。 */
export function collectCategories(
  items: ReadonlyArray<{ categories?: string | null }>
): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    for (const category of parseCategories(item.categories)) {
      seen.add(category);
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
