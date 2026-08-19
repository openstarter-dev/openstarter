import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  describe("paragraphs", () => {
    it("renders a single paragraph", () => {
      expect(renderMarkdown("Hello world")).toBe("<p>Hello world</p>");
    });

    it("renders multiple paragraphs separated by blank lines", () => {
      expect(renderMarkdown("First paragraph.\n\nSecond paragraph.")).toBe(
        "<p>First paragraph.</p>\n\n<p>Second paragraph.</p>",
      );
    });

    it("handles empty content", () => {
      expect(renderMarkdown("")).toBe("");
    });
  });

  describe("headings", () => {
    it("renders h1", () => {
      expect(renderMarkdown("# Heading 1")).toBe("<h1>Heading 1</h1>");
    });

    it("renders h2", () => {
      expect(renderMarkdown("## Heading 2")).toBe("<h2>Heading 2</h2>");
    });

    it("renders h3", () => {
      expect(renderMarkdown("### Heading 3")).toBe("<h3>Heading 3</h3>");
    });

    it("renders h6", () => {
      expect(renderMarkdown("###### Heading 6")).toBe("<h6>Heading 6</h6>");
    });

    it("processes inline formatting in headings", () => {
      expect(renderMarkdown("# **Bold** heading")).toBe("<h1><strong>Bold</strong> heading</h1>");
    });
  });

  describe("bold and italic", () => {
    it("renders bold text", () => {
      expect(renderMarkdown("**bold**")).toBe("<p><strong>bold</strong></p>");
    });

    it("renders italic text", () => {
      expect(renderMarkdown("*italic*")).toBe("<p><em>italic</em></p>");
    });

    it("renders bold and italic together", () => {
      expect(renderMarkdown("**bold** and *italic*")).toBe(
        "<p><strong>bold</strong> and <em>italic</em></p>",
      );
    });
  });

  describe("inline code", () => {
    it("renders inline code", () => {
      expect(renderMarkdown("`code`")).toBe("<p><code>code</code></p>");
    });

    it("renders inline code within text", () => {
      expect(renderMarkdown("Use the `foo()` function.")).toBe(
        "<p>Use the <code>foo()</code> function.</p>",
      );
    });
  });

  describe("links", () => {
    it("renders a link", () => {
      expect(renderMarkdown("[text](url)")).toBe('<p><a href="url">text</a></p>');
    });

    it("renders a link with inline formatting", () => {
      expect(renderMarkdown("[**bold link**](url)")).toBe(
        '<p><a href="url"><strong>bold link</strong></a></p>',
      );
    });
  });

  describe("code blocks", () => {
    it("renders a code block", () => {
      expect(renderMarkdown("```\ncode block\n```")).toBe("<pre><code>code block</code></pre>");
    });

    it("renders a code block with language", () => {
      expect(renderMarkdown("```ts\nconst x = 1;\n```")).toBe(
        '<pre><code class="language-ts">const x = 1;</code></pre>',
      );
    });

    it("renders a multi-line code block", () => {
      expect(renderMarkdown("```\nline 1\nline 2\nline 3\n```")).toBe(
        "<pre><code>line 1\nline 2\nline 3</code></pre>",
      );
    });
  });

  describe("lists", () => {
    it("renders an unordered list", () => {
      expect(renderMarkdown("- Item 1\n- Item 2")).toBe(
        "<ul>\n<li>Item 1</li>\n<li>Item 2</li>\n</ul>",
      );
    });

    it("renders an ordered list", () => {
      expect(renderMarkdown("1. First\n2. Second")).toBe(
        "<ol>\n<li>First</li>\n<li>Second</li>\n</ol>",
      );
    });

    it("renders a list with inline formatting", () => {
      expect(renderMarkdown("- **bold** item")).toBe(
        "<ul>\n<li><strong>bold</strong> item</li>\n</ul>",
      );
    });
  });

  describe("blockquotes", () => {
    it("renders a blockquote", () => {
      expect(renderMarkdown("> Quote")).toBe("<blockquote><p>Quote</p></blockquote>");
    });
  });

  describe("horizontal rules", () => {
    it("renders a horizontal rule with ---", () => {
      expect(renderMarkdown("---")).toBe("<hr />");
    });

    it("renders a horizontal rule with ***", () => {
      expect(renderMarkdown("***")).toBe("<hr />");
    });
  });

  describe("HTML escaping", () => {
    it("escapes script tags", () => {
      const result = renderMarkdown("<script>alert('xss')</script>");
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("escapes HTML tags in code blocks", () => {
      const result = renderMarkdown("```\n<script>alert('xss')</script>\n```");
      expect(result).toContain("&lt;script&gt;");
    });
  });

  describe("mixed content", () => {
    it("renders a full blog post", () => {
      const md = [
        "# Blog Title",
        "",
        "This is a **paragraph** with *formatting*.",
        "",
        "## Section 1",
        "",
        "Here is some `inline code` and a [link](https://example.com).",
        "",
        "```ts",
        'console.log("hello");',
        "```",
        "",
        "- Item 1",
        "- Item 2",
        "- Item 3",
        "",
        "> A wise quote.",
        "",
        "---",
        "",
        "Final paragraph.",
      ].join("\n");

      const result = renderMarkdown(md);
      expect(result).toContain("<h1>Blog Title</h1>");
      expect(result).toContain("<strong>paragraph</strong>");
      expect(result).toContain("<em>formatting</em>");
      expect(result).toContain("<h2>Section 1</h2>");
      expect(result).toContain("<code>inline code</code>");
      expect(result).toContain('<a href="https://example.com">link</a>');
      expect(result).toContain('<pre><code class="language-ts">');
      expect(result).toContain("<ul>");
      expect(result).toContain("<blockquote>");
      expect(result).toContain("<hr />");
      expect(result).toContain("<p>Final paragraph.</p>");
    });
  });
});
