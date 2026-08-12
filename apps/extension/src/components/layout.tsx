// apps/extension/src/components/layout.tsx
import { type ReactNode } from "react";
import { ErrorBoundary } from "./error-boundary";
import { SuspenseWrapper } from "./suspense";
import { Toaster } from "./toast";
import { Header } from "./header";
import { Footer } from "./footer";

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className="bg-background text-foreground flex min-h-screen w-full flex-col font-sans text-base">
      <ErrorBoundary>
        <SuspenseWrapper>
          <Toaster />
          <div className="mx-auto flex w-full max-w-7xl grow flex-col items-center justify-between gap-16 p-4">
            <Header />
            {children}
            <Footer />
          </div>
        </SuspenseWrapper>
      </ErrorBoundary>
    </div>
  );
}