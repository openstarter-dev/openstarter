import { createFileRoute } from "@tanstack/react-router";

import { ApiKeysPage } from "@/components/app/settings/apikeys";

export const Route = createFileRoute("/_app/settings/apikeys")({
  component: ApiKeysPage,
});
