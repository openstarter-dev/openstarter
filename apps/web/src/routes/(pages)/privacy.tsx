import { createFileRoute } from "@tanstack/react-router";

import { buildPageHead } from "@/lib/page-head";

import PrivacyContent from "./privacy.mdx";

export const Route = createFileRoute("/(pages)/privacy")({
  head: () =>
    buildPageHead({
      title: "Privacy Policy",
      description: "Privacy Policy",
      path: "/privacy",
    }),
  component: PrivacyContent,
});
