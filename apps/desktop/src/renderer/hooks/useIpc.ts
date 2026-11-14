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

  return { getVersion, openFile, saveFile };
}
