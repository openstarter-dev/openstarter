// packages/api/src/ai-tasks/save-files —— 生成文件转存对象存储的桥接与注入（R19.1 收尾）。
//
// AI 域（`../ai`）刻意**不直接依赖** storage，而是持有一个可注入的 `saveFiles` 回调
// （`SaveFilesFunction`）。本模块作为同包内的**组合点**，把该回调用 `../storage` 的上传能力实现
// 并经 `setSaveFiles` 注入 AI 管理器：使各供应商产出的临时文件被转存到对象存储、回写可访问 URL。
//
// 无存储渠道时（`getStorage()` 返回 `null`）按存储域既有语义走 **base64 内联兜底**：拉取供应商
// 临时文件字节并以 `data:` URL 回写（与 `storage/service.uploadImage` 的兜底一致，R18.3）。
// 任一文件转存失败仅记日志并保留其原始供应商 URL（不影响其余文件、不抛出）——转存是「尽力而为」，
// 不应让成功的生成结果因存储问题而丢失（对齐 `ai/save-files.persistMediaFiles` 的容错语义）。
//
// 注入在 api 组合根（`index.ts`）经 {@link registerAiSaveFiles} 调用一次；模块级幂等标记避免重复
// 注入导致管理器缓存被反复失效。

import { Buffer } from "node:buffer";
import { logger } from "@openstarter/shared/logger";
import { type AIFile, type SaveFilesFunction, setSaveFiles } from "../ai";
import { getStorage, type StorageManager } from "../storage/manager";

/** 拉取远端 URL 的字节内容（用于无存储渠道时的 base64 兜底）。 */
async function fetchAsBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch file (status ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * 转存单个文件并返回带可访问 URL 的结果：
 * - 有存储渠道 → `downloadAndUpload` 转存，成功回写可访问 URL，失败保留原始 URL；
 * - 无存储渠道 → 拉取字节并回写 `data:` base64 内联 URL（R18.3 兜底）。
 * 任一异常仅记日志并原样返回该文件（保留供应商临时 URL），不影响其余文件。
 */
async function persistOne(
  file: AIFile,
  storage: StorageManager | null
): Promise<AIFile> {
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

/**
 * 存储回调（`SaveFilesFunction`）：把一组生成文件转存到对象存储（无渠道走 base64 兜底），
 * 返回按原 `index` 保序、URL 已回写的结果，供 `ai/save-files.persistMediaFiles` 回填到任务结果。
 */
export const saveFilesToStorage: SaveFilesFunction = async (files) => {
  const storage = await getStorage();
  return await Promise.all(files.map((file) => persistOne(file, storage)));
};

// 幂等注入标记：`setSaveFiles` 会使 AI 管理器缓存失效，避免重复注入反复失效。
let registered = false;

/**
 * 在 api 组合根注入存储回调（R19.1）：把 {@link saveFilesToStorage} 注入 AI 管理器，
 * 使后续 `getAIManager()` 把回调透传给各供应商。多次调用仅首次生效（幂等）。
 */
export function registerAiSaveFiles(): void {
  if (registered) {
    return;
  }
  setSaveFiles(saveFilesToStorage);
  registered = true;
}
