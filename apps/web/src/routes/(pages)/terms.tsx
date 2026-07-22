import { createFileRoute } from "@tanstack/react-router";

import { BRAND_NAME } from "@/lib/branding";

import TermsContent from "./terms.mdx";

export const Route = createFileRoute("/(pages)/terms")({
  head: () => ({
    meta: [{ title: `Terms of Service - ${BRAND_NAME}` }],
  }),
  component: TermsContent,
});
