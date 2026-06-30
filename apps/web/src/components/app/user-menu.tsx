import { Button } from "@openstarter/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstarter/ui/components/dropdown-menu";
import { Skeleton } from "@openstarter/ui/components/skeleton";
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
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-2"
          />
        }
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
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56 bg-card">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNavigate} render={<Link to="/settings" />}>
          <Settings aria-hidden="true" className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  navigate({ to: "/" });
                },
              },
            });
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
