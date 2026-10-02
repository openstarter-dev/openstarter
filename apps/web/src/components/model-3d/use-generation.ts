import { useEffect, useRef, useState } from "react";
async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "same-origin" });
  const body = await response.json();
  if (!response.ok || body.code === -1)
    throw new Error(body.message || `Request failed (${response.status})`);
  return body.data;
}
export function useGeneration(onModel: (url: string) => void) {
  const [task, setTask] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const onModelRef = useRef(onModel);
  onModelRef.current = onModel;
  useEffect(() => {
    const saved = localStorage.getItem("greenplan-3d-task");
    if (saved) setTask(saved);
  }, []);
  useEffect(() => {
    if (!task) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const result = await request(`/api/model-3d/tasks/${encodeURIComponent(task)}`, {
          signal: controller.signal,
        });
        if (!active) return;
        if (result.status === "success" && result.fileUrl) {
          onModelRef.current(result.fileUrl);
          setStatus("Model ready");
          setTask("");
          localStorage.removeItem("greenplan-3d-task");
          return;
        }
        if (result.status === "failed") {
          setError("Generation failed. Check your provider task history.");
          setStatus("");
          setTask("");
          localStorage.removeItem("greenplan-3d-task");
          return;
        }
        setStatus("Generating your 3D model…");
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Unable to query task");
      }
      if (active) timer = setTimeout(poll, 8000);
    };
    void poll();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [task]);
  const generate = async (files: File[], prompt: string) => {
    if (busy.current || task) return;
    busy.current = true;
    setError("");
    setStatus("Uploading references…");
    try {
      const data = new FormData();
      files.forEach((f) => data.append("files", f));
      const uploaded = await request("/api/storage/upload-image", { method: "POST", body: data });
      if (
        !Array.isArray(uploaded.urls) ||
        uploaded.urls.length !== files.length ||
        uploaded.urls.some((url: unknown) => typeof url !== "string" || !url.startsWith("https://"))
      )
        throw new Error(
          "Configure public HTTPS object storage before generating. Local/base64 images cannot be submitted.",
        );
      setStatus("Submitting generation…");
      const created = await request("/api/model-3d/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: uploaded.urls, prompt }),
      });
      localStorage.setItem("greenplan-3d-task", created.id);
      setTask(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation request failed");
      setStatus("");
    } finally {
      busy.current = false;
    }
  };
  return {
    generate,
    status,
    error,
    isBusy:
      Boolean(task) || status === "Uploading references…" || status === "Submitting generation…",
  };
}
