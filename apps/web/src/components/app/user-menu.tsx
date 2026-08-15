import { Button } from "@openstarter/ui-web/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstarter/ui-web/components/dropdown-menu";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";

import { ThemeMenuItems } from "@/components/theme/theme-menu-items";
import { authClient } from "@/lib/auth-client";

export function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-10 w-full" />;
  }
  if (!session) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-auto w-full justify-start gap-2 px-2 py-2"
          variant="ghost"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-muted">
            <User aria-hidden="true" className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col items-start">
            <span className="truncate font-medium text-sm">
              {session.user.name}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {session.user.email}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-card" side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <ThemeMenuItems />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" onClick={onNavigate}>
            <Settings aria-hidden="true" className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
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
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
