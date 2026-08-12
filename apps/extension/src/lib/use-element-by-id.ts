// apps/extension/src/lib/use-element-by-id.ts
import { useEffect, useState } from "react";

export function useElementById(id: string): HTMLElement | null {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(id);
    setElement(el);
  }, [id]);

  return element;
}