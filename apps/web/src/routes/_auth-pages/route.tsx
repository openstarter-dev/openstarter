import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";
import { publicConfig } from "@/modules/public-config/lib/api";

export const Route = createFileRoute("/_auth-pages")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/dashboard" });
    }
  },
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(publicConfig.queries.get()),
  component: AuthPagesLayout,
});

function AuthPagesLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      <main id="main" className="w-full max-w-md">
        <Outlet />
      </main>
    </div>
  );
}
