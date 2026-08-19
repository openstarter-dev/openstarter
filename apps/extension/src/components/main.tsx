// apps/extension/src/components/main.tsx —— Placeholder main component for non-popup entrypoints.
import type { ReactNode } from "react";

export function Main({ className }: { className?: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">OpenStarter Extension</h1>
        <p className="text-muted-foreground mt-2">This entrypoint is under development.</p>
      </div>
    </div>
  );
}
