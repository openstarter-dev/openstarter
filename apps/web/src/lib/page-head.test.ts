import { describe, expect, it, beforeEach } from "vitest";
import { buildPageHead } from "./page-head";

describe("buildPageHead", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = "https://example.com";
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
      content:
        "A production-ready full-stack starter with auth, billing, and a polished UI.",
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
    expect(result.meta).toContainEqual({
      name: "twitter:card",
      content: "summary_large_image",
    });
    expect(result.meta).toContainEqual({
      name: "twitter:title",
      content: "About | openstarter",
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

  it("uses BETTER_AUTH_URL env var for site URL", () => {
    process.env.BETTER_AUTH_URL = "https://mysite.com";
    const result = buildPageHead({ title: "Page", path: "/page" });
    expect(result.links).toContainEqual({
      rel: "canonical",
      href: "https://mysite.com/page",
    });
  });

  it("falls back to localhost when BETTER_AUTH_URL is not set", () => {
    delete process.env.BETTER_AUTH_URL;
    const result = buildPageHead({ title: "Page", path: "/page" });
    expect(result.links).toContainEqual({
      rel: "canonical",
      href: "http://localhost:3000/page",
    });
  });
});