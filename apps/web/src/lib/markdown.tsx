// Lightweight markdown-to-HTML renderer for blog content.
// Handles basic markdown: paragraphs, headings, links, bold/italic,
// inline code, code blocks, lists, blockquotes, and horizontal rules.
// Uses dangerouslySetInnerHTML with a simple regex-based parser.
// Avoids heavy dependencies like react-markdown.

import React from "react";

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

function processInline(text: string): string {
  // Escape HTML to prevent XSS — must be done before markdown processing
  text = escapeHtml(text);
  // Bold (**text**) — must be processed before italic
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic (*text*)
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code (`text`)
  text = text.replace(/`(.+?)`/g, "<code>$1</code>");
  // Links [text](url)
  text = text.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2">$1</a>',
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

// Pure function exported for testing.
export function renderMarkdown(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];
  let inBlockquote = false;
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
      inBlockquote = false;
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      const tag = listType;
      const items = listItems
        .map((item) => `<li>${item}</li>`)
        .join("\n");
      result.push(`<${tag}>\n${items}\n</${tag}>`);
      listItems = [];
      inList = false;
    }
  }

  for (const line of lines) {
    // --- Code block ---
    if (inCodeBlock) {
      if (line.trim().startsWith("```")) {
        result.push(
          `<pre><code${codeBlockLang ? ` class="language-${codeBlockLang}"` : ""}>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`,
        );
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

    // --- Empty line ---
    if (line.trim() === "") {
      flushBlockquote();
      flushList();
      result.push("");
      continue;
    }

    // --- Horizontal rule ---
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushBlockquote();
      flushList();
      result.push("<hr />");
      continue;
    }

    // --- Heading ---
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushBlockquote();
      flushList();
      const level = headingMatch[1].length;
      const text = processInline(headingMatch[2]);
      result.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // --- Blockquote ---
    if (line.trim().startsWith("> ")) {
      flushList();
      inBlockquote = true;
      blockquoteLines.push(line.trim().slice(2));
      continue;
    }

    // --- List item ---
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

    // --- Paragraph ---
    flushBlockquote();
    flushList();
    result.push(`<p>${processInline(line)}</p>`);
  }

  // Flush any remaining open block
  if (inCodeBlock) {
    result.push(
      `<pre><code${codeBlockLang ? ` class="language-${codeBlockLang}"` : ""}>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`,
    );
  }
  flushBlockquote();
  flushList();

  return result.join("\n");
}