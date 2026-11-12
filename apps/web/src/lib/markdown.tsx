interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps) {
  const html = renderMarkdown(content);
  return (
    <div
      className="prose prose-neutral dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);

/**
 * Whether a (HTML-escaped) link URL is safe to put in an href attribute.
 * Scheme detection is case-insensitive and tested after trimming leading
 * control/whitespace characters; URLs with no scheme count as relative.
 */
export function isSafeHref(url: string): boolean {
  const schemeMatch = SCHEME_PATTERN.exec(url.trimStart());
  if (!schemeMatch) {
    return true;
  }
  return SAFE_SCHEMES.has(schemeMatch[1].toLowerCase());
}

const CODE_LANG_PATTERN = /^[A-Za-z0-9_+#.-]+$/;

function renderCodeBlock(lang: string, codeLines: string[]): string {
  const langClass = CODE_LANG_PATTERN.test(lang) ? ` class="language-${lang}"` : "";
  return `<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
}

function processInline(text: string): string {
  text = escapeHtml(text);
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  text = text.replace(/`(.+?)`/g, "<code>$1</code>");
  text = text.replace(/\[(.+?)\]\((.+?)\)/g, (_match, label: string, href: string) =>
    isSafeHref(href) ? `<a href="${href}">${label}</a>` : label,
  );
  return text;
}

function isListItem(line: string): [type: "ul" | "ol", content: string] | null {
  const ulMatch = line.match(/^[-*]\s+(.+)$/);
  if (ulMatch) return ["ul", ulMatch[1]];
  const olMatch = line.match(/^\d+\.\s+(.+)$/);
  if (olMatch) return ["ol", olMatch[1]];
  return null;
}

export function renderMarkdown(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];
  let blockquoteLines: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" = "ul";
  let listItems: string[] = [];

  function flushBlockquote() {
    if (blockquoteLines.length > 0) {
      result.push(
        `<blockquote><p>${processInline(blockquoteLines.join("<br />\n"))}</p></blockquote>`,
      );
      blockquoteLines = [];
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      const tag = listType;
      const items = listItems.map((item) => `<li>${item}</li>`).join("\n");
      result.push(`<${tag}>\n${items}\n</${tag}>`);
      listItems = [];
      inList = false;
    }
  }

  for (const line of lines) {
    if (inCodeBlock) {
      if (line.trim().startsWith("```")) {
        result.push(renderCodeBlock(codeBlockLang, codeBlockLines));
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockLines = [];
      } else {
        codeBlockLines.push(line);
      }
      continue;
    }

    if (line.trim().startsWith("```")) {
      flushBlockquote();
      flushList();
      inCodeBlock = true;
      codeBlockLang = line.trim().slice(3).trim();
      continue;
    }

    if (line.trim() === "") {
      flushBlockquote();
      flushList();
      result.push("");
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushBlockquote();
      flushList();
      result.push("<hr />");
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushBlockquote();
      flushList();
      const level = headingMatch[1].length;
      const text = processInline(headingMatch[2]);
      result.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    if (line.trim().startsWith("> ")) {
      flushList();
      blockquoteLines.push(line.trim().slice(2));
      continue;
    }

    const listMatch = isListItem(line);
    if (listMatch) {
      flushBlockquote();
      const [type, rawContent] = listMatch;
      if (inList && type !== listType) {
        flushList();
      }
      inList = true;
      listType = type;
      listItems.push(processInline(rawContent));
      continue;
    }

    flushBlockquote();
    flushList();
    result.push(`<p>${processInline(line)}</p>`);
  }

  if (inCodeBlock) {
    result.push(renderCodeBlock(codeBlockLang, codeBlockLines));
  }
  flushBlockquote();
  flushList();

  return result.join("\n");
}
