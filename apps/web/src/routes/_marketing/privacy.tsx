import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-bold text-3xl tracking-tight">Privacy Policy</h1>
      {/* TODO: replace with your own privacy policy. */}
      <p className="mt-4 text-muted-foreground">
        This is placeholder content. Replace it with your product privacy
        policy before launch.
      </p>
    </div>
  );
}
