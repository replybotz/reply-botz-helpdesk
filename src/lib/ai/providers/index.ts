import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { AiNotConfiguredError } from '../errors';
import { AnthropicProvider } from './anthropic';
import { OpenAiCompatibleProvider } from './openai-compatible';
import { PROVIDERS, isProviderId, type AiProvider, type ProviderId } from './types';

export * from './types';

export interface ProviderSettings {
  /** Overrides the registry default; required for custom/self-hosted endpoints. */
  baseUrl?: string;
}

export function createProvider(params: {
  providerId: ProviderId;
  model?: string | null;
  apiKey?: string;
  settings?: ProviderSettings;
}): AiProvider {
  const definition = PROVIDERS[params.providerId];
  const model = params.model?.trim() || definition.defaultModel;
  const baseUrl = params.settings?.baseUrl?.trim() || definition.baseUrl;

  if (!model) {
    throw new AiNotConfiguredError(`No model configured for ${definition.label}`);
  }
  if (definition.requiresBaseUrl && !baseUrl) {
    throw new AiNotConfiguredError(`${definition.label} requires a base URL`);
  }
  if (definition.requiresApiKey && !params.apiKey) {
    throw new AiNotConfiguredError(`${definition.label} requires an API key`);
  }

  if (definition.kind === 'anthropic') {
    return new AnthropicProvider(model, params.apiKey ?? '', baseUrl);
  }

  return new OpenAiCompatibleProvider(definition.id, model, {
    apiKey: params.apiKey,
    baseURL: baseUrl,
    supportsJsonSchema: definition.supportsJsonSchema,
  });
}

/** Resolve the tenant's active AI configuration into a ready provider. */
export async function getTenantProvider(tenantId: string): Promise<AiProvider> {
  const config = await prisma.aiConfiguration.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { provider: true, model: true, apiKey: true, settings: true },
  });

  if (!config) throw new AiNotConfiguredError();
  if (!isProviderId(config.provider)) {
    throw new AiNotConfiguredError(`Unsupported AI provider "${config.provider}"`);
  }

  const settings = (config.settings ?? {}) as ProviderSettings;
  // Providers that need no key are stored with an empty encrypted value.
  const apiKey = config.apiKey ? decrypt(config.apiKey) : undefined;

  return createProvider({
    providerId: config.provider,
    model: config.model,
    apiKey: apiKey || undefined,
    settings,
  });
}
