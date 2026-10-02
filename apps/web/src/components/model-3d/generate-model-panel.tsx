import { useGeneration } from "./use-generation";
import { useEffect, useRef, useState } from "react";
import { Box, ImagePlus, X } from "lucide-react";
import { ModelViewer } from "virtual:greenplan-model-viewer";
import "./model-3d.css";

type Reference = { file: File; url: string };

export function GenerateModelPanel({ onClose }: { onClose: () => void }) {
  const [references, setReferences] = useState<Reference[]>([]);
  const [model, setModel] = useState("");
  const generation = useGeneration(setModel);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const urls = useRef(new Set<string>());
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const remove = (index: number) => {
    const reference = references[index];
    if (reference) {
      URL.revokeObjectURL(reference.url);
      urls.current.delete(reference.url);
    }
    setReferences(references.filter((_, i) => i !== index));
  };
  return (
    <section
      className="model-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header>
        <div>
          <h2 id="model-title">
            <Box size={20} />
            Image to 3D
          </h2>
          <p>Hyper3D Gen-2 · Volcengine Ark</p>
        </div>
        <button onClick={onClose} aria-label="Close 3D panel">
          <X size={20} />
        </button>
      </header>
      <div className="model-panel-body">
        <div className="model-inputs">
          <h3>Reference images</h3>
          <p>
            Upload several views of the same object. You can add or remove images before generation.
          </p>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (references.length + files.length > 5) {
                setError("Choose 1–5 reference images per model.");
                return;
              }
              if (
                files.some(
                  (f) =>
                    !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
                    f.size > 10 * 1024 * 1024,
                )
              ) {
                setError("Choose JPG, PNG or WebP files under 10 MB each.");
                return;
              }
              if (
                references.reduce((sum, r) => sum + r.file.size, 0) +
                  files.reduce((sum, f) => sum + f.size, 0) >
                50 * 1024 * 1024
              ) {
                setError("Keep this reference batch under 50 MB.");
                return;
              }
              const added = files.map((file) => {
                const url = URL.createObjectURL(file);
                urls.current.add(url);
                return { file, url };
              });
              setReferences([...references, ...added]);
              setError("");
            }}
          />
          <button className="model-add" onClick={() => input.current?.click()}>
            <ImagePlus size={24} />
            Add reference images<span>{references.length}/5 images · JPG / PNG / WebP</span>
          </button>
          <div className="model-references">
            {references.map((r, i) => (
              <div key={r.url}>
                <img src={r.url} alt={r.file.name} />
                <button onClick={() => remove(i)} aria-label={`Remove ${r.file.name}`}>
                  <X size={13} />
                </button>
                <span>{r.file.name}</span>
              </div>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
          <label>
            Describe your model (optional)
            <textarea
              value={prompt}
              maxLength={4000}
              onChange={(e) => setPrompt(e.target.value)}
              style={{ width: "100%", background: "#303b33", padding: 10, marginTop: 8 }}
            />
          </label>
          <button
            className="model-generate"
            disabled={!references.length || generation.isBusy}
            onClick={() =>
              generation.generate(
                references.map((r) => r.file),
                prompt,
              )
            }
          >
            {generation.isBusy ? "Generating…" : "Generate 3D model"}
          </button>
          <p className="model-pending">
            Estimated provider cost: ¥1.80/model, per supplied pricing. Images are uploaded and sent
            to Volcengine Ark when you generate.
          </p>
          {generation.status && <p role="status">{generation.status}</p>}
          {generation.error && <p role="alert">{generation.error}</p>}
        </div>
        <div className="model-preview">
          {model ? (
            <ModelViewer url={model} />
          ) : (
            <div className="model-placeholder">
              <Box size={48} />
              <h3>Your 3D model will appear here</h3>
              <p>Orbit, pan and zoom the generated model.</p>
            </div>
          )}
          <label className="model-local">
            Preview an existing GLB
            <input
              type="file"
              accept=".glb"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (!file.name.toLowerCase().endsWith(".glb") || file.size > 100 * 1024 * 1024) {
                  setError("Choose a GLB under 100 MB.");
                  return;
                }
                if (model) {
                  URL.revokeObjectURL(model);
                  urls.current.delete(model);
                }
                const url = URL.createObjectURL(file);
                urls.current.add(url);
                setModel(url);
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
