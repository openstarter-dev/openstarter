import { Button } from "@openstarter/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserMenu } from "@/components/app/user-menu";
import { BRAND_NAME } from "@/lib/branding";

export function MobileTopbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 left-0 flex h-full w-72 flex-col bg-sidebar">
            <div className="flex h-12 items-center justify-between border-b px-3">
              <span className="font-semibold">{BRAND_NAME}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t p-2">
              <UserMenu onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
