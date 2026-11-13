export class AIProviderUnavailableError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`AI provider '${provider}' is not enabled or its credentials are missing`);
    this.name = "AIProviderUnavailableError";
    this.provider = provider;
  }
}

export interface AIProviderErrorInfo {
  provider: string;
  model?: string;
  statusCode?: number;
  message: string;
}

export function normalizeProviderError(args: {
  provider: string;
  model?: string;
  error: unknown;
  statusCode?: number;
}): AIProviderErrorInfo {
  const { provider, model, error, statusCode } = args;
  const message = error instanceof Error ? error.message : "unknown AI provider error";
  return { provider, model, statusCode, message };
}

export class AIProviderRequestError extends Error {
  readonly provider: string;
  readonly statusCode: number;

  constructor(provider: string, statusCode: number, detail?: string) {
    super(
      detail
        ? `AI provider '${provider}' request failed with status ${statusCode}: ${detail}`
        : `AI provider '${provider}' request failed with status ${statusCode}`,
    );
    this.name = "AIProviderRequestError";
    this.provider = provider;
    this.statusCode = statusCode;
  }
}
