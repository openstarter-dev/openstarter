// apps/desktop/src/renderer/hooks/useIpc.ts
// 类型安全的 IPC hook

import { useCallback } from "react";

export function useIpc() {
  const api = window.electronAPI;

  const getVersion = useCallback(() => api?.getVersion() ?? Promise.resolve(""), [api]);
  const openFile = useCallback(
    (options?: { filters?: { name: string; extensions: string[] }[] }) =>
      api?.openFile(options) ?? Promise.resolve(null),
    [api],
  );
  const saveFile = useCallback(
    (data: string, options?: { defaultName?: string }) =>
      api?.saveFile(data, options) ?? Promise.resolve(null),
    [api],
  );
  const readFile = useCallback(
    (path: string) => api?.readFile(path) ?? Promise.resolve(null),
    [api],
  );
  const writeFile = useCallback(
    (path: string, data: string) => api?.writeFile(path, data) ?? Promise.resolve(false),
    [api],
  );

  return { getVersion, openFile, saveFile, readFile, writeFile };
}
