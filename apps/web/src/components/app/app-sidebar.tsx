// apps/web/src/components/app/app-sidebar.tsx
// Primary app sidebar built on the shared shadcn Sidebar primitives
// (@openstarter/ui-web/components/sidebar): collapsible to icons on desktop
// (state persisted in the sidebar_state cookie, Cmd/Ctrl+B toggles) and a
// slide-in Sheet on mobile — replacing the old hand-rolled Sidebar + Drawer.

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@openstarter/ui-web/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openstarter/ui-web/components/sidebar";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Globe, LogOut, Moon, Sun, User, UserCog } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { ManageAccountDialog } from "@/components/app/manage-account-dialog";
import { APP_NAV_ITEMS } from "@/components/app/app-nav";
import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";
import { m } from "@/paraglide/messages.js";
import { getLocale, setLocale } from "@/paraglide/runtime.js";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
] as const;

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

function ThemeMenuItem() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? theme : "system";

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="flex items-center gap-2">
        <Moon className="size-4" />
        {m["user_menu.theme"]()}
        <span className="ml-auto text-muted-foreground">
          {currentTheme === "dark"
            ? m["common.nav.theme_dark"]()
            : currentTheme === "light"
              ? m["common.nav.theme_light"]()
              : m["common.nav.theme_system"]()}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`flex items-center gap-2 ${mounted && theme === option.value ? "font-medium" : ""}`}
          >
            <option.icon className="size-4" />
            {option.value === "light"
              ? m["common.nav.theme_light"]()
              : m["common.nav.theme_dark"]()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function LanguageMenuItem() {
  const currentLocale = getLocale();

  const handleLanguageChange = (newLocale: string) => {
    if (newLocale !== currentLocale) {
      setLocale(newLocale as "en" | "zh");
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="flex items-center gap-2">
        <Globe className="size-4" />
        {m["common.nav.language"]()}
        <span className="ml-auto text-muted-foreground">
          {currentLocale === "en" ? "English" : "中文"}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {LANGUAGE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleLanguageChange(option.value)}
            className={currentLocale === option.value ? "font-medium" : ""}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

interface SessionUserSummary {
  user: { email: string; name: string };
}

export function AppSidebar({ initialSession }: { initialSession?: SessionUserSummary | null }) {
  const navigate = useNavigate();
  const [manageOpen, setManageOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  // `_app` 的 beforeLoad 在 SSR 阶段已拿到会话，但 better-auth 的 useSession store 首帧
  // 恒为 pending（且挂载后会自行再拉一次），直接渲染会先出骨架再跳成用户名。
  // 用路由上下文兜首帧；store 解析后自动接管，保留改资料 / 登出的响应性。
  const activeSession = session ?? initialSession ?? null;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/dashboard">
                <span className="font-semibold text-base">{BRAND_NAME}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{m["common.platform"]()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {APP_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {activeSession ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User aria-hidden="true" className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="truncate font-medium text-sm">{activeSession.user.name}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {activeSession.user.email}
                      </span>
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-card" side="top">
                  <DropdownMenuItem onClick={() => setManageOpen(true)}>
                    <UserCog aria-hidden="true" className="size-4" />
                    {m["user_menu.manage_account"]()}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ThemeMenuItem />
                  <LanguageMenuItem />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => {
                            navigate({ to: "/" });
                          },
                        },
                      });
                    }}
                    variant="destructive"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    {m["user_menu.sign_out"]()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
                <ManageAccountDialog onOpenChange={setManageOpen} open={manageOpen} />
              </DropdownMenu>
            ) : isPending ? (
              <Skeleton className="h-10 w-full" />
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
