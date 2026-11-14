import { readBooleanEnv, readEnv } from "../../../lib/env";
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

type MediaEnvValues = Partial<Record<(typeof AI_ENV_KEYS)[number], string>>;

interface MediaProviderDescriptor {
  isDefault: (defaultProvider: string) => boolean;
  build: (saveFiles: SaveFilesFunction | undefined) => AIProvider | null;
}

/**
 * Check whether an AI media provider is enabled (`*_ENABLED !== false`) and has all credentials.
 * 校验 AI 媒体渠道是否启用（未设为 false）且必需环境变量均已填写。
 */
function isAvailable(enabledKey: string, requiredKeys: readonly string[]): boolean {
  if (!readBooleanEnv(enabledKey, true)) {
    return false;
  }
  return requiredKeys.every((key) => Boolean(readEnv(key)));
}

// Registry of supported AI media providers, constructed cleanly without repeated conditionals.
// AI 媒体渠道装配注册表，避免分散的重复分支判断。
const MEDIA_PROVIDER_ASSEMBLERS: readonly MediaProviderDescriptor[] = [
  {
    isDefault: (defaultProvider) => defaultProvider === "replicate" || defaultProvider === "",
    build: (saveFiles) => {
      if (!isAvailable("REPLICATE_ENABLED", ["REPLICATE_API_TOKEN"])) {
        return null;
      }
      return new ReplicateProvider({
        apiToken: readEnv("REPLICATE_API_TOKEN"),
        baseUrl: readEnv("REPLICATE_BASE_URL") || undefined,
        saveFiles,
        customStorage: Boolean(saveFiles),
      });
    },
  },
  {
    isDefault: (defaultProvider) => defaultProvider === "openai",
    build: (saveFiles) => {
      if (!isAvailable("OPENAI_ENABLED", ["OPENAI_API_KEY"])) {
        return null;
      }
      return new OpenAIImageProvider({
        apiKey: readEnv("OPENAI_API_KEY"),
        baseUrl: readEnv("OPENAI_BASE_URL") || undefined,
        saveFiles,
        customStorage: Boolean(saveFiles),
      });
    },
  },
  {
    isDefault: (defaultProvider) => defaultProvider === "fal",
    build: (saveFiles) => {
      if (!isAvailable("FAL_ENABLED", ["FAL_API_KEY"])) {
        return null;
      }
      return new FalProvider({
        apiKey: readEnv("FAL_API_KEY"),
        saveFiles,
        customStorage: Boolean(saveFiles),
      });
    },
  },
  {
    isDefault: (defaultProvider) => defaultProvider === "newapi",
    build: (saveFiles) => {
      if (!isAvailable("NEWAPI_ENABLED", ["NEWAPI_BASE_URL", "NEWAPI_API_KEY"])) {
        return null;
      }
      return new NewAPIProvider({
        apiKey: readEnv("NEWAPI_API_KEY"),
        baseUrl: readEnv("NEWAPI_BASE_URL"),
        saveFiles,
        customStorage: Boolean(saveFiles),
      });
    },
  },
];

// Declarative env key list ensures any provider toggle/credential rotation invalidates cachedManager.
// 声明式环境变量键清单，确保任意开关变更或密钥轮换使缓存失效。
const AI_ENV_KEYS = [
  "DEFAULT_AI_PROVIDER",
  "REPLICATE_ENABLED",
  "REPLICATE_API_TOKEN",
  "REPLICATE_BASE_URL",
  "FAL_ENABLED",
  "FAL_API_KEY",
  "OPENAI_ENABLED",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "NEWAPI_ENABLED",
  "NEWAPI_BASE_URL",
  "NEWAPI_API_KEY",
] as const;

/**
 * Snapshot relevant AI media env values for cache fingerprinting (accepts overrides for testing).
 * 读取当前 AI 媒体相关环境变量快照（测试可直接传入覆盖对象计算缓存指纹）。
 */
export function computeConfigHash(values?: MediaEnvValues): string {
  return JSON.stringify(AI_ENV_KEYS.map((key) => (values ? values[key] || "" : readEnv(key))));
}

/**
 * Assemble configured AI media providers from runtime environment variables and cache by fingerprint.
 * 从环境变量装配已启用的 AI 媒体供应商，并按配置指纹复用实例。
 */
export async function getAIManager(): Promise<AIManager> {
  const hash = computeConfigHash();

  if (cachedManager && hash === cachedHash) {
    return cachedManager;
  }

  const manager = new AIManager();
  if (registeredSaveFiles) {
    manager.setSaveFiles(registeredSaveFiles);
  }
  const defaultProvider = readEnv("DEFAULT_AI_PROVIDER");

  for (const assembler of MEDIA_PROVIDER_ASSEMBLERS) {
    const provider = assembler.build(registeredSaveFiles);
    if (provider) {
      manager.addProvider(provider, assembler.isDefault(defaultProvider));
    }
  }

  cachedManager = manager;
  cachedHash = hash;
  return manager;
}
