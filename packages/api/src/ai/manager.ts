// packages/api/src/ai/manager —— AI 供应商管理器与「按 Config 动态装配」
// （对齐 ShipAny `core/ai/index.ts` 的 AIManager，R19.1）。
//
// - `AIManager`：登记/按名取用已装配 provider 的容器；默认渠道取显式设定或首个登记者。
//   并持有可注入的 `saveFiles` 存储回调（`setSaveFiles`/`saveFiles`）。
// - `setSaveFiles(fn)`（模块级 DI 入口）：注入存储回调——生成的文件结果经该回调落对象存储。
//   回调由调用方（api 层）用 `packages/api/storage` 的上传能力提供；AI 模块只持有并调用注入的
//   回调，不直接依赖具体存储实现（保持内聚/可测/解耦）。注入后使缓存失效，令后续装配把回调
//   透传给各 provider。
// - `getAIManager()`：读取 Config（`@openstarter/shared` 的 config 服务），按「渠道未显式禁用
//   且凭证齐备」装配 provider（Replicate 为主，Fal 等其他受配置启用的供应商），并注入 saveFiles；
//   相关 Config 未变时复用缓存实例，变化时（hash 改变）重建（对齐 billing getPaymentManager /
//   storage getStorage）。
//
// 说明：`getProvider(name)` 精确返回同名 provider 或 `undefined`（不回退默认），以便路由分派
// 据此对「未启用/凭证缺失」的渠道明确拒绝并返回不可用错误（R19.3）。

import { getAllConfigs } from "@openstarter/shared/config";
import { FalProvider } from "./fal";
import { ReplicateProvider } from "./replicate";
import {
  AIMediaType,
  type AIProvider,
  type SaveFilesFunction,
} from "./types";

/**
 * AI 供应商管理器：持有一组已装配的 provider 与可注入的存储回调。
 * 路由分派经此按名取用 provider；`saveFiles` 在装配时透传给各 provider。
 */
export class AIManager {
  private readonly providers: AIProvider[] = [];
  private defaultProvider?: AIProvider;
  private saveFilesFn?: SaveFilesFunction;

  /** 注入存储回调（R19.1）：生成的文件结果经该回调落对象存储。 */
  setSaveFiles(fn: SaveFilesFunction): void {
    this.saveFilesFn = fn;
  }

  /** 当前注入的存储回调（未注入时为 undefined）。 */
  get saveFiles(): SaveFilesFunction | undefined {
    return this.saveFilesFn;
  }

  /** 登记一个 provider；`isDefault` 为真时设为默认渠道。 */
  addProvider(provider: AIProvider, isDefault = false): void {
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  /** 按供应商名取 provider；不存在返回 `undefined`（不回退默认，见文件头说明）。 */
  getProvider(name: string): AIProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  /** 已装配的全部供应商名。 */
  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  /** 支持的媒体类型清单。 */
  getMediaTypes(): string[] {
    return Object.values(AIMediaType);
  }

  /** 默认渠道：显式设定优先，否则取首个已装配渠道（可能为 undefined）。 */
  getDefaultProvider(): AIProvider | undefined {
    if (!this.defaultProvider && this.providers.length > 0) {
      const [first] = this.providers;
      this.defaultProvider = first;
    }
    return this.defaultProvider;
  }
}

// ─── 模块级存储回调注入（DI 入口，survives rebuild） ─────────────────────────

// 注入的存储回调保存在模块作用域，使按 Config 重建管理器时回调不丢失（每次装配都重新透传）。
let registeredSaveFiles: SaveFilesFunction | undefined;

/**
 * 注入存储回调（R19.1，模块级 DI 入口，供 api 组合根启动时调用一次）。
 * 记录回调并使管理器缓存失效，令后续 `getAIManager()` 把回调透传给各 provider。
 */
export function setSaveFiles(fn: SaveFilesFunction): void {
  registeredSaveFiles = fn;
  cachedManager = null;
  cachedHash = "";
}

// ─── 按 Config 动态装配（含 hash 重建，R19.1） ───────────────────────────────

let cachedManager: AIManager | null = null;
let cachedHash = "";

/**
 * 供应商是否可用：未被显式禁用（`{provider}_enabled !== "false"`）且全部凭证齐备。
 * 覆盖 R19.3 的两种不可用成因——「未启用」与「凭证缺失」，二者皆判为不装配。
 */
function isAvailable(
  configs: Record<string, string>,
  provider: string,
  credentialKeys: readonly string[]
): boolean {
  if (configs[`${provider}_enabled`] === "false") {
    return false;
  }
  return credentialKeys.every((key) => Boolean(configs[key]));
}

function assembleReplicate(
  manager: AIManager,
  configs: Record<string, string>,
  saveFiles: SaveFilesFunction | undefined,
  defaultProvider: string
): void {
  if (!isAvailable(configs, "replicate", ["replicate_api_token"])) {
    return;
  }
  manager.addProvider(
    new ReplicateProvider({
      apiToken: configs.replicate_api_token || "",
      baseUrl: configs.replicate_base_url || undefined,
      saveFiles,
      customStorage: Boolean(saveFiles),
    }),
    // Replicate 为主：显式指定为 replicate 或未指定默认时，作为默认渠道。
    defaultProvider === "replicate" || defaultProvider === ""
  );
}

function assembleFal(
  manager: AIManager,
  configs: Record<string, string>,
  saveFiles: SaveFilesFunction | undefined,
  defaultProvider: string
): void {
  if (!isAvailable(configs, "fal", ["fal_api_key"])) {
    return;
  }
  manager.addProvider(
    new FalProvider({
      apiKey: configs.fal_api_key || "",
      saveFiles,
      customStorage: Boolean(saveFiles),
    }),
    defaultProvider === "fal"
  );
}

/** 相关 Config 的指纹：任一 AI 相关键变化即触发管理器重建。 */
function computeConfigHash(configs: Record<string, string>): string {
  return JSON.stringify([
    configs.default_ai_provider || "",
    configs.replicate_enabled || "",
    configs.replicate_api_token || "",
    configs.replicate_base_url || "",
    configs.fal_enabled || "",
    configs.fal_api_key || "",
  ]);
}

/**
 * 读取 Config 并装配已启用供应商（注入 saveFiles）；相关 Config 未变时复用缓存实例，
 * 变化时重建。仅装配「未显式禁用且凭证齐备」的供应商，未启用/凭证缺失者不会被登记
 * （据此路由分派可对其明确拒绝，R19.3）。
 */
export async function getAIManager(): Promise<AIManager> {
  const configs = await getAllConfigs();
  const hash = computeConfigHash(configs);

  if (cachedManager && hash === cachedHash) {
    return cachedManager;
  }

  const manager = new AIManager();
  if (registeredSaveFiles) {
    manager.setSaveFiles(registeredSaveFiles);
  }
  const defaultProvider = configs.default_ai_provider || "";

  assembleReplicate(manager, configs, registeredSaveFiles, defaultProvider);
  assembleFal(manager, configs, registeredSaveFiles, defaultProvider);

  cachedManager = manager;
  cachedHash = hash;
  return manager;
}
