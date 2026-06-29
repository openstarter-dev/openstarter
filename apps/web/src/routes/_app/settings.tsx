import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="font-bold text-2xl">Settings</h1>
      {/* TODO(phase-1): account settings (profile, security, sessions) */}
      <p className="text-muted-foreground">
        Account settings arrive in Phase 1. See docs/superpowers/specs for the
        roadmap.
      </p>
    </div>
  );
}
