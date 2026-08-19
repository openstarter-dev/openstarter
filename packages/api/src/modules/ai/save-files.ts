// packages/api/src/ai/save-files —— 生成文件转存的共享助手（供各 provider 复用）。
//
// 把「构建待转存文件 → 调用注入的 saveFiles 回调 → 按 index 回写可访问 URL」的通用流程集中于此，
// 使各供应商（replicate/fal/...）无需各自重复该逻辑。回调失败经 logger 记录且不抛出——
// 转存失败不应影响主流程（成功的生成结果仍可用其原始 URL 返回），对齐 ShipAny 的容错语义。

import { logger } from "@openstarter/shared/logger";
import type { AIFile, SaveFilesFunction } from "./types";

/**
 * 转存一组媒体项并回写其 URL（就地修改 `items`）。
 * - 未注入 `saveFiles`、无可转存项、或回调失败/未返回 → 原样保留（不修改 URL、不抛出）。
 * - 成功 → 按 `index` 将转存后的可访问 URL 回写到对应项。
 *
 * @typeParam T 媒体项类型（如 AIImage / AIVideo），其 URL 经 `getUrl`/`setUrl` 存取。
 */
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
