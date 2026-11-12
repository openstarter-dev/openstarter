import { m } from "@openstarter/i18n-web/messages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openstarter/ui-web/components/dialog";
import { cn } from "@openstarter/ui-web/lib/utils";
import type { ComponentType } from "react";
import { useState } from "react";

import { AccountsPage } from "@/components/app/settings/accounts";
import { ApiKeysPage } from "@/components/app/settings/apikeys";
import { BillingPage } from "@/components/app/settings/billing";
import { CreditsPage } from "@/components/app/settings/credits";
import { DangerPage } from "@/components/app/settings/danger";
import { PaymentsPage } from "@/components/app/settings/payments";
import { ProfilePage } from "@/components/app/settings/profile";
import { SecurityPage } from "@/components/app/settings/security";
import { SessionsPage } from "@/components/app/settings/sessions";
import { TicketsPage } from "@/components/app/settings/tickets";

const SECTIONS = [
  { component: ProfilePage, key: "profile", label: () => m["settings.nav.profile"]() },
  { component: BillingPage, key: "billing", label: () => m["settings.nav.billing"]() },
  { component: CreditsPage, key: "credits", label: () => m["settings.nav.credits"]() },
  { component: PaymentsPage, key: "payments", label: () => m["settings.nav.payments"]() },
  { component: ApiKeysPage, key: "apikeys", label: () => m["settings.nav.apikeys"]() },
  { component: TicketsPage, key: "tickets", label: () => m["settings.nav.tickets"]() },
  { component: SecurityPage, key: "security", label: () => m["settings.nav.security"]() },
  { component: AccountsPage, key: "accounts", label: () => m["settings.nav.accounts"]() },
  { component: SessionsPage, key: "sessions", label: () => m["settings.nav.sessions"]() },
  { component: DangerPage, key: "danger", label: () => m["settings.nav.danger"]() },
] as const satisfies readonly {
  component: ComponentType;
  key: string;
  label: () => string;
}[];

export function ManageAccountDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [active, setActive] = useState<string>("profile");
  const activeSection = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0];
  const ActiveSection = activeSection.component;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{m["settings.manage_account"]()}</DialogTitle>
          <DialogDescription>{m["settings.layout.description"]()}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-hidden md:flex-row">
          <nav
            aria-label={m["common.a11y.account_sections"]()}
            className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-48 md:flex-col md:overflow-y-auto md:overflow-x-visible"
          >
            {SECTIONS.map((section) => {
              const isActive = section.key === active;
              return (
                <button
                  className={cn(
                    "cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                  key={section.key}
                  onClick={() => setActive(section.key)}
                  type="button"
                >
                  {section.label()}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto pr-1">
            <ActiveSection key={active} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
