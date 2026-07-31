import { Button } from "@openstarter/ui-web/components/button";
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
          aria-expanded={open}
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Menu aria-hidden="true" />
        </Button>
        <Link className="font-semibold" to="/dashboard">
          {BRAND_NAME}
        </Link>
      </div>

      <Drawer
        className="bg-sidebar"
        label="Navigation"
        onClose={close}
        open={open}
        side="left"
      >
        <div className="flex h-12 items-center justify-between border-b px-3">
          <span className="font-semibold">{BRAND_NAME}</span>
          <Button
            aria-label="Close menu"
            onClick={close}
            size="icon"
            type="button"
            variant="ghost"
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
