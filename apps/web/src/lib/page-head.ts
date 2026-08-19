// Build TanStack Router head() meta/links arrays from structured page metadata.
// Generates: title, description, canonical, Open Graph, Twitter Card.

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";

export interface PageHeadInput {
  title: string;
  description?: string;
  image?: string;
  path: string;
  type?: "website" | "article";
}

export interface PageHead {
  meta: Record<string, string>[];
  links: Record<string, string>[];
}

function getSiteUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

function absolutizeUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = getSiteUrl().replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export function buildPageHead(input: PageHeadInput): PageHead {
  const fullTitle = `${input.title} | ${BRAND_NAME}`;
  const description = input.description ?? BRAND_DESCRIPTION;
  const url = absolutizeUrl(input.path);
  const image = input.image ? absolutizeUrl(input.image) : undefined;

  const meta: Record<string, string>[] = [
    { title: fullTitle },
    { name: "description", content: description },
    // Open Graph
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: input.type ?? "website" },
    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
  ];

  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }

  const links: Record<string, string>[] = [{ rel: "canonical", href: url }];

  return { meta, links };
}
