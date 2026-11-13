import { logger } from "@openstarter/shared/logger";
import type { AIFile, SaveFilesFunction } from "./types";

export async function persistMediaFiles<T>(args: {
  items: T[];
  getUrl: (item: T) => string | undefined;
  setUrl: (item: T, url: string) => void;
  saveFiles: SaveFilesFunction | undefined;
  uuid: () => string;
  keyPrefix: string;
  contentType: string;
  type: string;
  ext: string;
}): Promise<void> {
  const { items, getUrl, setUrl, saveFiles, uuid, keyPrefix, contentType, type, ext } = args;

  if (!saveFiles) {
    return;
  }

  const filesToSave: AIFile[] = [];
  for (const [index, item] of items.entries()) {
    const url = getUrl(item);
    if (url) {
      filesToSave.push({
        url,
        contentType,
        key: `${keyPrefix}/${type}/${uuid()}.${ext}`,
        index,
        type,
      });
    }
  }
  if (filesToSave.length === 0) {
    return;
  }

  let uploaded: AIFile[] | undefined;
  try {
    uploaded = await saveFiles(filesToSave);
  } catch (error) {
    logger.error(`[ai:${keyPrefix}] save files failed`, error);
    return;
  }
  if (!uploaded) {
    return;
  }

  for (const file of uploaded) {
    if (file.url && file.index !== undefined) {
      const item = items[file.index];
      if (item) {
        setUrl(item, file.url);
      }
    }
  }
}
