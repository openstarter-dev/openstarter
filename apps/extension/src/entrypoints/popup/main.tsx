// placeholder minimal TS entrypoint —— 让 wxt prepare 与 tsc --noEmit 在
// Task 3 之前有 .tsx 可发现（避免 TS18003）。Task 8 会用真实装配替换本文件。
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<StrictMode>Placeholder</StrictMode>);
}
