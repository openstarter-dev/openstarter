import { describe, expect, it } from "vitest";

import {
  buildAnalyticsHeadScripts,
  googleAnalyticsScripts,
  isValidMeasurementId,
  isValidPlausibleDomain,
  plausibleScripts,
  resolvePlausibleSrc,
} from "./scripts";

const VALID_GA_ID = "G-ABCDEF1234";
const VALID_DOMAIN = "example.com";

describe("analytics-web scripts — isValidMeasurementId (R25.1)", () => {
  it("accepts GA Measurement IDs across formats", () => {
    expect(isValidMeasurementId("G-ABCDEF1234")).toBe(true);
    expect(isValidMeasurementId("UA-12345-6")).toBe(true);
    expect(isValidMeasurementId("AW-12345")).toBe(true);
    expect(isValidMeasurementId("A-B_C-1")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(isValidMeasurementId("")).toBe(false);
  });

  it("rejects ids exceeding the length cap (64)", () => {
    expect(isValidMeasurementId(`${"a".repeat(64)}`)).toBe(true);
    expect(isValidMeasurementId(`${"a".repeat(65)}`)).toBe(false);
  });

  it("rejects ids with disallowed characters (attack payloads)", () => {
    // 引号 / 标签拆解字符必须被拒，防止内联脚本被断开
    expect(isValidMeasurementId("G-abc'</script>")).toBe(false);
    expect(isValidMeasurementId('G-`";')).toBe(false);
    expect(isValidMeasurementId("G-abc def")).toBe(false);
    expect(isValidMeasurementId("G-abc/def")).toBe(false);
    expect(isValidMeasurementId("G-abc?def")).toBe(false);
    expect(isValidMeasurementId("G-abc=def")).toBe(false);
  });
});

describe("analytics-web scripts — isValidPlausibleDomain (R25.2)", () => {
  it("accepts single and multi-domain variants", () => {
    expect(isValidPlausibleDomain("example.com")).toBe(true);
    expect(isValidPlausibleDomain("a.b.c.example.com")).toBe(true);
    expect(isValidPlausibleDomain("example.com,sub.example.com")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(isValidPlausibleDomain("")).toBe(false);
  });

  it("rejects domains exceeding the length cap (253)", () => {
    expect(isValidPlausibleDomain(`${"a".repeat(253)}.com`)).toBe(false);
  });

  it("rejects domains with disallowed characters (attack payloads)", () => {
    expect(isValidPlausibleDomain("example.com'</script>")).toBe(false);
    expect(isValidPlausibleDomain('example.com";')).toBe(false);
    expect(isValidPlausibleDomain("example.com/path")).toBe(false);
    expect(isValidPlausibleDomain("exa mple.com")).toBe(false);
  });
});

describe("analytics-web scripts — resolvePlausibleSrc (R25.2)", () => {
  it("falls back to the official source when src is empty", () => {
    expect(resolvePlausibleSrc("")).toBe("https://plausible.io/js/script.js");
  });

  it("accepts a valid https absolute URL", () => {
    expect(resolvePlausibleSrc("https://analytics.example.com/js/script.js")).toBe(
      "https://analytics.example.com/js/script.js",
    );
  });

  it("falls back to official source for non-https (http) URLs", () => {
    expect(resolvePlausibleSrc("http://analytics.example.com/js/script.js")).toBe(
      "https://plausible.io/js/script.js",
    );
  });

  it("falls back to official source for malformed URLs", () => {
    expect(resolvePlausibleSrc("not-a-url")).toBe("https://plausible.io/js/script.js");
    expect(resolvePlausibleSrc("javascript:alert(1)")).toBe("https://plausible.io/js/script.js");
  });
});

describe("analytics-web scripts — googleAnalyticsScripts", () => {
  it("produces a loader and an init script for a valid id", () => {
    const [loader, init] = googleAnalyticsScripts(VALID_GA_ID);
    expect(loader?.id).toBe("ga-loader");
    expect(loader?.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${VALID_GA_ID}`);
    expect(loader?.async).toBe(true);

    expect(init?.id).toBe("ga-init");
    expect(init?.children).toContain("window.dataLayer");
    expect(init?.children).toContain(`gtag('config','${VALID_GA_ID}')`);
  });
});

describe("analytics-web scripts — plausibleScripts", () => {
  it("produces a static init stub and a domain-scoped loader", () => {
    const [init, loader] = plausibleScripts(VALID_DOMAIN, "https://x.io/js/script.js");
    expect(init?.id).toBe("plausible-init");
    expect(init?.children).toContain("window.plausible");

    expect(loader?.id).toBe("plausible-loader");
    expect(loader?.["data-domain"]).toBe(VALID_DOMAIN);
    expect(loader?.src).toBe("https://x.io/js/script.js");
    expect(loader?.defer).toBe(true);
    expect(loader?.async).toBe(true);
  });

  it("loader src transparently passes through the given plausible src", () => {
    // `plausibleScripts` 本身为纯模板构造，不做 https 归一；归一由 `buildAnalyticsHeadScripts`
    // 调用 `resolvePlausibleSrc` 完成。透传是设计：调用方负责传入已归一的 src。
    const [, loader] = plausibleScripts(VALID_DOMAIN, "https://analytics.example.com/js/script.js");
    expect(loader?.src).toBe("https://analytics.example.com/js/script.js");
  });
});

describe("analytics-web scripts — buildAnalyticsHeadScripts (R25.1 / R25.2)", () => {
  it("returns no scripts when config is undefined", () => {
    expect(buildAnalyticsHeadScripts(undefined)).toEqual([]);
  });

  it("returns no scripts when all identifiers are empty", () => {
    expect(
      buildAnalyticsHeadScripts({
        googleAnalyticsId: "",
        plausibleDomain: "",
        plausibleSrc: "",
      }),
    ).toEqual([]);
  });

  it("injects only the Google Analytics scripts when only ga id is configured", () => {
    const scripts = buildAnalyticsHeadScripts({
      googleAnalyticsId: VALID_GA_ID,
      plausibleDomain: "",
      plausibleSrc: "",
    });
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.id).toBe("ga-loader");
    expect(scripts[1]?.id).toBe("ga-init");
  });

  it("injects only the Plausible scripts when only domain is configured", () => {
    const scripts = buildAnalyticsHeadScripts({
      googleAnalyticsId: "",
      plausibleDomain: VALID_DOMAIN,
      plausibleSrc: "https://analytics.example.com/js/script.js",
    });
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.id).toBe("plausible-init");
    expect(scripts[1]?.id).toBe("plausible-loader");
  });

  it("injects both providers when both are configured and valid", () => {
    const scripts = buildAnalyticsHeadScripts({
      googleAnalyticsId: VALID_GA_ID,
      plausibleDomain: VALID_DOMAIN,
      plausibleSrc: "",
    });
    expect(scripts).toHaveLength(4);
    expect(scripts.map((s) => s.id)).toEqual([
      "ga-loader",
      "ga-init",
      "plausible-init",
      "plausible-loader",
    ]);
  });

  it("skips the Google Analytics provider when its id is invalid (XSS payload)", () => {
    const scripts = buildAnalyticsHeadScripts({
      googleAnalyticsId: "G-x'</script>",
      plausibleDomain: VALID_DOMAIN,
      plausibleSrc: "",
    });
    // 仅 Plausible 的 2 项；GA 的注入被跳过
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.id).toBe("plausible-init");
  });

  it("skips the Plausible provider when its domain is invalid (XSS payload)", () => {
    const scripts = buildAnalyticsHeadScripts({
      googleAnalyticsId: VALID_GA_ID,
      plausibleDomain: "a';</script>",
      plausibleSrc: "",
    });
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.id).toBe("ga-loader");
  });

  it("normalizes an insecure plausibleSrc to the official https source via buildAnalyticsHeadScripts", () => {
    const scripts = buildAnalyticsHeadScripts({
      googleAnalyticsId: "",
      plausibleDomain: VALID_DOMAIN,
      plausibleSrc: "http://insecure.example.com/js/script.js",
    });
    const loader = scripts.find((s) => s.id === "plausible-loader");
    expect(loader?.src).toBe("https://plausible.io/js/script.js");
  });
});
