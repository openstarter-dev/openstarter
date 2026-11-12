import { describe, expect, it, beforeEach } from "vitest";
import { buildPageHead } from "./page-head";

describe("buildPageHead", () => {
  beforeEach(() => {
    process.env.VITE_APP_URL = "https://example.com";
  });

  it("generates title with brand suffix", () => {
    const result = buildPageHead({ title: "About", path: "/about" });
    expect(result.meta).toContainEqual({ title: "About | openstarter" });
  });

  it("generates description meta tag", () => {
    const result = buildPageHead({
      title: "About",
      description: "Learn about us",
      path: "/about",
    });
    expect(result.meta).toContainEqual({
      name: "description",
      content: "Learn about us",
    });
  });

  it("uses default description when not provided", () => {
    const result = buildPageHead({ title: "About", path: "/about" });
    expect(result.meta).toContainEqual({
      name: "description",
      content: "A production-ready full-stack starter with auth, billing, and a polished UI.",
    });
  });

  it("generates OG tags", () => {
    const result = buildPageHead({ title: "About", path: "/about" });
    expect(result.meta).toContainEqual({
      property: "og:title",
      content: "About | openstarter",
    });
    expect(result.meta).toContainEqual({
      property: "og:type",
      content: "website",
    });
  });

  it("generates Twitter Card tags", () => {
    const result = buildPageHead({ title: "About", path: "/about" });
    // 无 og:image 时降级为 summary，避免声明 large_image 却缺图。
    expect(result.meta).toContainEqual({
      name: "twitter:card",
      content: "summary",
    });
    expect(result.meta).toContainEqual({
      name: "twitter:title",
      content: "About | openstarter",
    });
  });

  it("upgrades twitter:card to summary_large_image when an image is present", () => {
    const result = buildPageHead({ title: "Post", path: "/blog/p", image: "/og.png" });
    expect(result.meta).toContainEqual({
      name: "twitter:card",
      content: "summary_large_image",
    });
  });

  it("does not duplicate the brand name in the title", () => {
    const result = buildPageHead({ title: "openstarter", path: "/" });
    expect(result.meta).toContainEqual({ title: "openstarter" });
    expect(result.meta).not.toContainEqual({ title: "openstarter | openstarter" });
  });

  it("emits og:site_name and locale-aware og:locale", () => {
    const result = buildPageHead({ title: "About", path: "/about" });
    expect(result.meta).toContainEqual({ property: "og:site_name", content: "openstarter" });
    expect(result.meta).toContainEqual({ property: "og:locale", content: "en_US" });
    expect(result.meta).toContainEqual({ property: "og:locale:alternate", content: "zh_CN" });
  });

  it("emits og:url matching the canonical URL", () => {
    const result = buildPageHead({ title: "About", path: "/about" });
    const canonical = result.links.find((link) => link.rel === "canonical");
    expect(result.meta).toContainEqual({
      property: "og:url",
      content: canonical?.href,
    });
  });

  describe("locale-aware canonical and hreflang", () => {
    it("self-canonicalizes the default locale without a prefix", () => {
      const result = buildPageHead({ title: "About", path: "/about", locale: "en" });
      expect(result.links).toContainEqual({
        rel: "canonical",
        href: "https://example.com/about",
      });
    });

    it("self-canonicalizes a localized URL instead of pointing at the default locale", () => {
      const result = buildPageHead({ title: "About", path: "/about", locale: "zh" });
      // 修复前：/zh/about 的 canonical 会指向英文版 /about，zh 内容被判为重复。
      expect(result.links).toContainEqual({
        rel: "canonical",
        href: "https://example.com/zh/about",
      });
    });

    it("declares hreflang alternates for every locale plus x-default", () => {
      const result = buildPageHead({ title: "About", path: "/about", locale: "en" });
      expect(result.links).toContainEqual({
        rel: "alternate",
        hrefLang: "en",
        href: "https://example.com/about",
      });
      expect(result.links).toContainEqual({
        rel: "alternate",
        hrefLang: "zh",
        href: "https://example.com/zh/about",
      });
      expect(result.links).toContainEqual({
        rel: "alternate",
        hrefLang: "x-default",
        href: "https://example.com/about",
      });
    });

    it("keeps og:url consistent with the localized canonical", () => {
      const result = buildPageHead({ title: "About", path: "/about", locale: "zh" });
      expect(result.meta).toContainEqual({
        property: "og:url",
        content: "https://example.com/zh/about",
      });
    });
  });

  it("generates canonical link", () => {
    const result = buildPageHead({ title: "About", path: "/about" });
    expect(result.links).toContainEqual({
      rel: "canonical",
      href: "https://example.com/about",
    });
  });

  it("absolutizes relative paths", () => {
    const result = buildPageHead({
      title: "Test",
      path: "blog/hello-world",
    });
    expect(result.links).toContainEqual({
      rel: "canonical",
      href: "https://example.com/blog/hello-world",
    });
  });

  it("adds OG image when provided", () => {
    const result = buildPageHead({
      title: "Post",
      path: "/blog/post-1",
      image: "/images/og.png",
    });
    expect(result.meta).toContainEqual({
      property: "og:image",
      content: "https://example.com/images/og.png",
    });
    expect(result.meta).toContainEqual({
      name: "twitter:image",
      content: "https://example.com/images/og.png",
    });
  });

  it("keeps absolute URLs as-is", () => {
    const result = buildPageHead({
      title: "Post",
      path: "/blog/post-1",
      image: "https://cdn.example.com/img.jpg",
    });
    expect(result.meta).toContainEqual({
      property: "og:image",
      content: "https://cdn.example.com/img.jpg",
    });
  });

  it("uses article type when specified", () => {
    const result = buildPageHead({
      title: "Post",
      path: "/blog/post-1",
      type: "article",
    });
    expect(result.meta).toContainEqual({
      property: "og:type",
      content: "article",
    });
  });

  it("strips trailing slash from the configured site URL", () => {
    process.env.VITE_APP_URL = "https://mysite.com/";
    const result = buildPageHead({ title: "Page", path: "/page" });
    expect(result.links).toContainEqual({
      rel: "canonical",
      href: "https://mysite.com/page",
    });
  });

  it("falls back to localhost when VITE_APP_URL is not set", () => {
    delete process.env.VITE_APP_URL;
    const result = buildPageHead({ title: "Page", path: "/page" });
    expect(result.links).toContainEqual({
      rel: "canonical",
      href: "http://localhost:3000/page",
    });
  });
});
