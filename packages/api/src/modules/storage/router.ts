import { Buffer } from "node:buffer";
import { respData, respErr } from "@openstarter/shared";
import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/plan-gate";
import { UploadLimitError } from "./errors";
import { uploadImage } from "./service";

const DEFAULT_MAX_KB = 2048;
const MAX_FILES = 9;
const BAD_REQUEST_STATUS = 400;
const DATA_URL_PREFIX = /^data:[^;]+;base64,/;

/** 归一化后的单个上传条目。 */
interface UploadInput {
  body: Uint8Array;
  contentType: string;
  filename?: string;
}

const base64Item = z.object({
  contentType: z.string().min(1),
  data: z.string().min(1),
  filename: z.string().min(1).optional(),
});

const base64Body = z.object({
  files: z.array(base64Item).min(1).max(MAX_FILES),
});

/** 从 Config 解析上传大小上限（KB）；非法/缺省回退默认值。 */
async function resolveMaxKb(): Promise<number> {
  const configs = await getAllConfigs();
  const raw = Number(configs.inline_image_max_kb);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_KB;
}

/** 解码 base64（可含 `data:` URL 前缀）为字节。 */
function decodeBase64(input: string): Uint8Array {
  const base64 = input.replace(DATA_URL_PREFIX, "");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/** multipart 文件条目的结构化形态：只声明 parseMultipart 实际用到的成员。 */
interface MultipartFilePart {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name?: string;
  type: string;
}

function hasArrayBuffer(value: object): value is MultipartFilePart {
  return typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function";
}

/** 解析 multipart/form-data 的 `files` 字段为归一化条目。 */
async function parseMultipart(request: Request): Promise<UploadInput[]> {
  const form = await request.formData();
  const parts: MultipartFilePart[] = [];
  for (const entry of form.getAll("files")) {
    if (typeof entry !== "string" && hasArrayBuffer(entry)) {
      parts.push(entry);
    }
  }
  return await Promise.all(
    parts.map(async (file) => ({
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      filename: file.name,
    })),
  );
}

/** 解析 JSON base64 入参为归一化条目。 */
async function parseBase64(request: Request): Promise<UploadInput[]> {
  const json: unknown = await request.json();
  const parsed = base64Body.safeParse(json);
  if (!parsed.success) {
    throw new Error("invalid base64 payload");
  }
  return parsed.data.files.map((item) => ({
    body: decodeBase64(item.data),
    contentType: item.contentType,
    filename: item.filename,
  }));
}

export const storageRouter = new Hono().post(
  "/storage/upload-image",
  requireAuth,
  requirePlan("member"),
  async (c) => {
    const contentType = c.req.header("content-type") ?? "";

    let inputs: UploadInput[];
    try {
      inputs = contentType.includes("multipart/form-data")
        ? await parseMultipart(c.req.raw)
        : await parseBase64(c.req.raw);
    } catch (err) {
      logger.warn("[storage] failed to parse upload payload", err);
      return c.json(respErr("invalid upload payload"), BAD_REQUEST_STATUS);
    }

    if (inputs.length === 0) {
      return c.json(respErr("no files provided"), BAD_REQUEST_STATUS);
    }
    if (inputs.length > MAX_FILES) {
      return c.json(respErr(`too many files (max ${MAX_FILES})`), BAD_REQUEST_STATUS);
    }

    const maxKb = await resolveMaxKb();

    try {
      const results = await Promise.all(
        inputs.map((input) =>
          uploadImage({
            body: input.body,
            contentType: input.contentType,
            maxKb,
          }),
        ),
      );

      return c.json(
        respData({
          results: results.map((r, i) => ({
            filename: inputs[i]?.filename,
            inline: r.inline,
            url: r.url,
          })),
          urls: results.map((r) => r.url),
        }),
      );
    } catch (err) {
      if (err instanceof UploadLimitError) {
        throw new HTTPException(BAD_REQUEST_STATUS, {
          cause: err,
          message: err.message,
        });
      }
      throw err;
    }
  },
);
