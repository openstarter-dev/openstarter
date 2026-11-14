import { getAllConfigs } from "@openstarter/shared/config";
import { FalProvider } from "./fal";
import { NewAPIProvider } from "./newapi";
import { OpenAIImageProvider } from "./openai-image";
import { ReplicateProvider } from "./replicate";
import { AIMediaType, type AIProvider, type SaveFilesFunction } from "./types";

export class AIManager {
  private readonly providers: AIProvider[] = [];
  private defaultProvider?: AIProvider;
  private saveFilesFn?: SaveFilesFunction;

  setSaveFiles(fn: SaveFilesFunction): void {
    this.saveFilesFn = fn;
  }

  get saveFiles(): SaveFilesFunction | undefined {
    return this.saveFilesFn;
  }

  addProvider(provider: AIProvider, isDefault = false): void {
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  getMediaTypes(): string[] {
    return Object.values(AIMediaType);
  }

  getDefaultProvider(): AIProvider | undefined {
    if (!this.defaultProvider && this.providers.length > 0) {
      const [first] = this.providers;
      this.defaultProvider = first;
    }
    return this.defaultProvider;
  }
}

let registeredSaveFiles: SaveFilesFunction | undefined;

export function setSaveFiles(fn: SaveFilesFunction): void {
  registeredSaveFiles = fn;
  cachedManager = null;
  cachedHash = "";
}


let cachedManager: AIManager | null = null;
let cachedHash = "";

function isAvailable(
  configs: Record<string, string>,
  provider: string,
  credentialKeys: readonly string[],
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
  defaultProvider: string,
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
    defaultProvider === "replicate" || defaultProvider === "",
  );
}

function assembleOpenAIImage(
  manager: AIManager,
  configs: Record<string, string>,
  saveFiles: SaveFilesFunction | undefined,
  defaultProvider: string,
): void {
  if (!isAvailable(configs, "openai", ["openai_api_key"])) {
    return;
  }
  manager.addProvider(
    new OpenAIImageProvider({
      apiKey: configs.openai_api_key || "",
      baseUrl: configs.openai_base_url || undefined,
      saveFiles,
      customStorage: Boolean(saveFiles),
    }),
    defaultProvider === "openai",
  );
}

function assembleFal(
  manager: AIManager,
  configs: Record<string, string>,
  saveFiles: SaveFilesFunction | undefined,
  defaultProvider: string,
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
    defaultProvider === "fal",
  );
}

function assembleNewAPI(
  manager: AIManager,
  configs: Record<string, string>,
  saveFiles: SaveFilesFunction | undefined,
  defaultProvider: string,
): void {
  if (!isAvailable(configs, "newapi", ["newapi_base_url", "newapi_api_key"])) {
    return;
  }
  manager.addProvider(
    new NewAPIProvider({
      apiKey: configs.newapi_api_key || "",
      baseUrl: configs.newapi_base_url || "",
      saveFiles,
      customStorage: Boolean(saveFiles),
    }),
    defaultProvider === "newapi",
  );
}

// Declarative key list ensures every provider toggle/credential invalidates cachedManager
// 通过统一配置键清单生成指纹，避免新增或漏配开关（如 openai_enabled）导致缓存不失效
const AI_CONFIG_HASH_KEYS = [
  "default_ai_provider",
  "replicate_enabled",
  "replicate_api_token",
  "replicate_base_url",
  "fal_enabled",
  "fal_api_key",
  "openai_enabled",
  "openai_api_key",
  "openai_base_url",
  "newapi_enabled",
  "newapi_base_url",
  "newapi_api_key",
] as const;

export function computeConfigHash(configs: Record<string, string>): string {
  return JSON.stringify(AI_CONFIG_HASH_KEYS.map((key) => configs[key] || ""));
}

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
  assembleOpenAIImage(manager, configs, registeredSaveFiles, defaultProvider);
  assembleFal(manager, configs, registeredSaveFiles, defaultProvider);
  assembleNewAPI(manager, configs, registeredSaveFiles, defaultProvider);

  cachedManager = manager;
  cachedHash = hash;
  return manager;
}
