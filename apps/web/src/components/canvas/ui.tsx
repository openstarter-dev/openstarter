import { AssetLibrary } from "./asset-library";
import { lazy, Suspense, useRef, useState } from "react";
const GenerateModelPanel = lazy(() =>
  import("../model-3d/generate-model-panel").then((module) => ({
    default: module.GenerateModelPanel,
  })),
);
import {
  ArrowUpRight,
  Check,
  Frame,
  Hand,
  Home,
  ImagePlus,
  MessageSquare,
  MousePointer2,
  Pencil,
  Redo2,
  Share2,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";
import { getSnapshot, useEditor, useValue, type Editor } from "tldraw";

const tools = [
  { id: "select", label: "Select (V)", icon: MousePointer2 },
  { id: "hand", label: "Pan (H / hold Space)", icon: Hand },
  { id: "draw", label: "Draw (D)", icon: Pencil },
  { id: "arrow", label: "Annotate with arrow (A)", icon: ArrowUpRight },
  { id: "text", label: "Text (T)", icon: Type },
  { id: "note", label: "Sticky note (N)", icon: StickyNote },
  { id: "frame", label: "Frame (F)", icon: Frame },
];
export function CanvasToolbar() {
  const editor = useEditor();
  const current = useValue("tool", () => editor.getCurrentToolId(), [editor]);
  const zoom = useValue("zoom", () => Math.round(editor.getZoomLevel() * 100), [editor]);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  return (
    <div className="board-toolbar" role="toolbar" aria-label="Canvas tools">
      {error && (
        <div className="board-upload-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.some((file) => file.size > 10 * 1024 * 1024)) {
            setError("Each image must be smaller than 10 MB.");
            return;
          }
          if (
            files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type))
          ) {
            setError("Use PNG, JPG or WebP images.");
            return;
          }
          try {
            await editor.putExternalContent({
              type: "files",
              files,
              point: editor.getViewportPageBounds().center,
            });
            setError("");
          } catch {
            setError("Could not upload images. Please try again.");
          }
        }}
      />
      <button
        className="board-upload"
        title="Upload sketches, renders, references or materials"
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={20} />
        <span>Upload images</span>
      </button>
      <button title="Generate a 3D model from reference images" onClick={() => setModelOpen(true)}>
        Image to 3D
      </button>
      {modelOpen && (
        <Suspense fallback={<div role="status">Opening 3D tools…</div>}>
          <GenerateModelPanel onClose={() => setModelOpen(false)} />
        </Suspense>
      )}
      <span className="board-divider" />
      {tools.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          aria-label={label}
          title={label}
          aria-pressed={current === id}
          className={current === id ? "active" : ""}
          onClick={() => editor.setCurrentTool(id)}
        >
          <Icon size={21} />
        </button>
      ))}
      <button
        aria-label="Add comment as a shared sticky note"
        title="Comment · shared sticky note"
        onClick={() => editor.setCurrentTool("note")}
      >
        <MessageSquare size={20} />
      </button>

      <span className="board-divider" />
      <button aria-label="Undo" title="Undo" onClick={() => editor.undo()}>
        <Undo2 size={18} />
      </button>
      <button aria-label="Redo" title="Redo" onClick={() => editor.redo()}>
        <Redo2 size={18} />
      </button>
      <button
        className="board-zoom"
        title="Fit all content"
        onClick={() => editor.zoomToFit({ animation: { duration: 200 } })}
      >
        {zoom}%
      </button>
    </div>
  );
}
export function CanvasHeader({
  editor,
  room,
  connection,
}: {
  editor: Editor;
  room?: string;
  connection?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const collaborators = useValue("collaborators", () => editor.getCollaborators(), [editor]);
  const backup = () => {
    const blob = new Blob([JSON.stringify(getSnapshot(editor.store).document)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "greenplan-board.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <AssetLibrary editor={editor} />
      <header className="board-header">
        <a className="board-home" href="/" aria-label="Home">
          <Home size={18} />
        </a>
        <span className="board-title">
          GreenPlan <span>/</span> {room ? "Shared workspace" : "My workspace"}
        </span>
        <span className="board-save">
          {room
            ? connection === "online"
              ? `${collaborators.length + 1} online`
              : "Reconnecting…"
            : "Saved on this device"}
        </span>
        <button onClick={backup}>Backup</button>
        <button className="board-share" onClick={() => setShareOpen(!shareOpen)}>
          <Share2 size={15} />
          Share
        </button>
      </header>
      <div className="board-hint">
        {room
          ? "Changes and cursors sync live · comments use shared notes"
          : "Drop your sketches, renders and references anywhere"}
      </div>
      {shareOpen && (
        <section className="board-share-panel" aria-label="Share workspace">
          <h2>{room ? "Invite collaborators" : "Create a shared workspace"}</h2>
          <p>
            {room
              ? "Anyone with this private link can edit this room. Share it with your collaborators."
              : "Open a new empty room for live collaboration. Your local board stays on this device."}
          </p>
          {room ? (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setError("");
                } catch {
                  setError("Copy the room link from your browser address bar.");
                }
              }}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}{" "}
              {copied ? "Link copied" : "Copy room link"}
            </button>
          ) : (
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("room", crypto.randomUUID());
                window.location.assign(url.href);
              }}
            >
              Create shared room
            </button>
          )}
          {error && <p role="alert">{error}</p>}
          <button onClick={() => setShareOpen(false)}>Close</button>
        </section>
      )}
    </>
  );
}
