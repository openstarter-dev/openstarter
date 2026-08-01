/**
 * Data 命令：list / get / create。
 * 消费 packages/api 的 /api/notes（列表、单条、创建），信封由 api-client 解包。
 */

import type { Command } from "commander";
import { createApiClient, requireAuthOrThrow } from "../lib/api-client.js";
import { handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";

interface Note {
  readonly createdAt: string;
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export function registerDataCommands(program: Command): void {
  program
    .command("list")
    .description("列出笔记")
    .option("--limit <n>", "限制返回数量", `${DEFAULT_LIMIT}`)
    .option("--json", "以 JSON 格式输出")
    .action(async (options) => {
      try {
        requireAuthOrThrow();
        const client = createApiClient();
        const limit = clampLimit(options.limit);
        const data = await client.request<Note[]>(`/api/notes?limit=${limit}`);
        formatOutput(data, options.json);
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command("get")
    .description("获取单个笔记")
    .argument("<id>", "笔记 ID")
    .option("--json", "以 JSON 格式输出")
    .action(async (id, options) => {
      try {
        requireAuthOrThrow();
        const client = createApiClient();
        const note = await client.request<Note>(`/api/notes/${id}`);
        formatOutput(note, options.json);
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command("create")
    .description("创建新笔记")
    .requiredOption("--name <name>", "笔记名称")
    .option("--description <desc>", "笔记描述")
    .action(async (options) => {
      try {
        requireAuthOrThrow();
        const client = createApiClient();
        const note = await client.request<Note>("/api/notes", {
          body: JSON.stringify({
            description: options.description,
            name: options.name,
          }),
          method: "POST",
        });
        console.log(`✓ 已创建笔记: ${note.id}`);
      } catch (error) {
        handleError(error as Error, false);
      }
    });
}

/** 把 --limit 输入规整到 [1, MAX_LIMIT]；非法值回落默认。 */
function clampLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}
