import { Buffer } from "node:buffer";
import { respData, respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/plan-gate";
import { base64Body, MAX_FILES } from "../../schema/storage";
import { UploadLimitError } from "./errors";
import { type UploadInput, uploadImages } from "./service";

const BAD_REQUEST_STATUS = 400;
const DATA_URL_PREFIX = /^data:[^;]+;base64,/;

function decodeBase64(input: string): Uint8Array {
  const base64 = input.replace(DATA_URL_PREFIX, "");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

interface MultipartFilePart {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name?: string;
  type: string;
}

function hasArrayBuffer(value: object): value is MultipartFilePart {
  return typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function";
}

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

    try {
      const { results, urls } = await uploadImages(inputs);
      return c.json(respData({ results, urls }));
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
