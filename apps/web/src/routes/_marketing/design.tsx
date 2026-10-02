import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { z } from "zod";
import "@/canvas.css";

export const Route = createFileRoute("/_marketing/design")({
  validateSearch: z.object({ room: z.string().uuid().optional() }),
  component: DesignPage,
});

function DesignPage() {
  const { room } = Route.useSearch();
  const [Canvas, setCanvas] = useState<ComponentType<{ room?: string }> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    import("@/components/canvas/design-canvas")
      .then((module) => {
        if (active) setCanvas(() => module.DesignCanvas);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <div className="canvas-loading" role="alert">
        <strong>Canvas could not load</strong>
        <p>Please reload to try again.</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  if (!Canvas)
    return <div className="canvas-starting" aria-busy="true" aria-label="Loading canvas" />;
  return <Canvas key={room ?? "local"} room={room} />;
}
