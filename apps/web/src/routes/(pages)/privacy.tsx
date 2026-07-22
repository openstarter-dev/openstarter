import { createFileRoute } from "@tanstack/react-router";

import { BRAND_NAME } from "@/lib/branding";

import PrivacyContent from "./privacy.mdx";

export const Route = createFileRoute("/(pages)/privacy")({
  head: () => ({
    meta: [{ title: `Privacy Policy - ${BRAND_NAME}` }],
  }),
  component: PrivacyContent,
});
