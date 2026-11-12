import { SidebarTrigger } from "@openstarter/ui-web/components/sidebar";
import { useRouterState } from "@tanstack/react-router";

import { getAppNavTitle } from "@/components/app/app-nav";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggleIcon } from "@/components/theme/theme-toggle-icon";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = getAppNavTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger aria-label="Toggle sidebar" />
      {title ? <span className="truncate text-sm font-medium">{title}</span> : null}
      <div className="ml-auto flex items-center gap-2">
        {children}
        <LanguageSwitcher />
        <ThemeToggleIcon />
      </div>
    </header>
  );
}
