import { Button } from "@openstarter/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useCallback, useState } from "react";

import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserMenu } from "@/components/app/user-menu";
import { Drawer } from "@/components/drawer";
import { BRAND_NAME } from "@/lib/branding";

export function MobileTopbar() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="md:hidden">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" />
        </Button>
        <Link to="/dashboard" className="font-semibold">
          {BRAND_NAME}
        </Link>
      </div>

      <Drawer open={open} onClose={close} side="left" label="Navigation" className="bg-sidebar">
        <div className="flex h-12 items-center justify-between border-b px-3">
          <span className="font-semibold">{BRAND_NAME}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={close}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <SidebarNav onNavigate={close} />
        </div>
        <div className="border-t p-2">
          <UserMenu onNavigate={close} />
        </div>
      </Drawer>
    </div>
  );
}
