import { createFileRoute } from "@tanstack/react-router";

import { buildPageHead } from "@/lib/page-head";

import TermsContent from "./terms.mdx";

export const Route = createFileRoute("/(pages)/terms")({
  head: () =>
    buildPageHead({
      title: "Terms of Service",
      description: "Terms of Service",
      path: "/terms",
    }),
  component: TermsContent,
});
