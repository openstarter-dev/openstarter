import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-bold text-3xl tracking-tight">Terms of Service</h1>
      {/* TODO: replace with your own terms of service. */}
      <p className="mt-4 text-muted-foreground">
        This is placeholder content. Replace it with your product terms of
        service before launch.
      </p>
    </div>
  );
}
