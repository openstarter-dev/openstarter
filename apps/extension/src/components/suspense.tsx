// apps/extension/src/components/suspense.tsx
import { Suspense, type ReactNode } from "react";

interface SuspenseWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SuspenseWrapper({ children, fallback }: SuspenseWrapperProps) {
  return (
    <Suspense
      fallback={
        fallback ?? (
          <div className="flex min-h-[200px] items-center justify-center">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        )
      }
    >
      {children}
    </Suspense>
  );
}