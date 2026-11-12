import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
