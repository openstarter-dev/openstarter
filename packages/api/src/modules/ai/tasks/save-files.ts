import { Buffer } from "node:buffer";
import { logger } from "@openstarter/shared/logger";
import { type AIFile, type SaveFilesFunction, setSaveFiles } from "../media";
import { getStorage, type StorageManager } from "../../storage/manager";

async function fetchAsBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch file (status ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function persistOne(file: AIFile, storage: StorageManager | null): Promise<AIFile> {
  try {
    if (storage) {
      const result = await storage.downloadAndUpload({
        url: file.url,
        key: file.key,
        contentType: file.contentType,
      });
      if (result.success && result.url) {
        return { ...file, url: result.url };
      }
      return file;
    }

    const bytes = await fetchAsBytes(file.url);
    const base64 = Buffer.from(bytes).toString("base64");
    return { ...file, url: `data:${file.contentType};base64,${base64}` };
  } catch (error) {
    logger.warn("[ai-tasks] failed to persist generated file", error);
    return file;
  }
}

export const saveFilesToStorage: SaveFilesFunction = async (files) => {
  const storage = await getStorage();
  return await Promise.all(files.map((file) => persistOne(file, storage)));
};

let registered = false;

export function registerAiSaveFiles(): void {
  if (registered) {
    return;
  }
  setSaveFiles(saveFilesToStorage);
  registered = true;
}
