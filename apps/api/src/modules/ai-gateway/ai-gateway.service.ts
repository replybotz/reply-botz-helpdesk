import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IAiProvider,
  AiChatRequest,
  AiChatResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiModerationRequest,
  AiModerationResponse,
  AiFeatureConfig,
  AiProviderConfig,
} from './interfaces/ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';

// Default model configuration per feature
const DEFAULT_FEATURE_CONFIGS: AiFeatureConfig[] = [
  {
    feature: 'chat',
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 4096 },
    fallbackChain: [
      { provider: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 4096 },
      { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
    ],
  },
  {
    feature: 'ticket',
    primary: { provider: 'openai', model: 'gpt-4o', temperature: 0.3, maxTokens: 2048 },
    fallbackChain: [
      { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3, maxTokens: 2048 },
    ],
  },
  {
    feature: 'kb_generation',
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.5, maxTokens: 3000 },
    fallbackChain: [
      { provider: 'openai', model: 'gpt-4o', temperature: 0.5, maxTokens: 3000 },
    ],
  },
  {
    feature: 'embedding',
    primary: { provider: 'openai', model: 'text-embedding-3-small' },
    fallbackChain: [],
  },
  {
    feature: 'moderation',
    primary: { provider: 'openai', model: 'text-moderation-latest' },
    fallbackChain: [],
  },
];

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly providers: Map<string, IAiProvider>;
  private readonly featureConfigs: Map<string, AiFeatureConfig>;

  constructor(
    private readonly configService: ConfigService,
    private readonly openAi: OpenAiProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly google: GoogleProvider,
    private readonly openRouter: OpenRouterProvider,
  ) {
    this.providers = new Map<string, IAiProvider>([
      ['openai', this.openAi],
      ['anthropic', this.anthropic],
      ['google', this.google],
      ['openrouter', this.openRouter],
    ]);

    this.featureConfigs = new Map(
      DEFAULT_FEATURE_CONFIGS.map((c) => [c.feature, c]),
    );
  }

  /**
   * Run a chat completion for a specific feature with automatic fallback.
   */
  async chat(
    request: AiChatRequest,
    feature = 'chat',
    overrideProvider?: string,
    overrideModel?: string,
  ): Promise<AiChatResponse> {
    const config = this.featureConfigs.get(feature);
    if (!config) throw new Error(`Unknown AI feature: ${feature}`);

    const chain = [config.primary, ...config.fallbackChain];

    // Allow per-request overrides
    if (overrideProvider || overrideModel) {
      chain.unshift({
        provider: overrideProvider ?? config.primary.provider,
        model: overrideModel ?? config.primary.model,
        temperature: config.primary.temperature,
        maxTokens: config.primary.maxTokens,
      });
    }

    return this.executeWithFallback(chain, async (cfg) => {
      const provider = this.providers.get(cfg.provider);
      if (!provider) throw new Error(`Provider not found: ${cfg.provider}`);

      return provider.chat({
        ...request,
        model: request.model ?? cfg.model,
        temperature: request.temperature ?? cfg.temperature,
        maxTokens: request.maxTokens ?? cfg.maxTokens,
      });
    });
  }

  /**
   * Generate embeddings with automatic fallback.
   */
  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    const config = this.featureConfigs.get('embedding');
    if (!config) throw new Error('Embedding feature not configured');

    return this.executeWithFallback([config.primary, ...config.fallbackChain], async (cfg) => {
      const provider = this.providers.get(cfg.provider);
      if (!provider?.embed) throw new Error(`Provider ${cfg.provider} does not support embeddings`);
      return provider.embed({ ...request, model: request.model ?? cfg.model });
    });
  }

  /**
   * Run content moderation.
   */
  async moderate(request: AiModerationRequest): Promise<AiModerationResponse> {
    const config = this.featureConfigs.get('moderation');
    if (!config) throw new Error('Moderation feature not configured');

    return this.executeWithFallback([config.primary, ...config.fallbackChain], async (cfg) => {
      const provider = this.providers.get(cfg.provider);
      if (!provider?.moderate) {
        throw new Error(`Provider ${cfg.provider} does not support moderation`);
      }
      return provider.moderate(request);
    });
  }

  /**
   * Execute a function with exponential backoff fallback chain.
   */
  private async executeWithFallback<T>(
    chain: AiProviderConfig[],
    fn: (config: AiProviderConfig) => Promise<T>,
    maxRetries = 2,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (const config of chain) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
            await this.sleep(delay);
            this.logger.warn(
              `Retrying ${config.provider}/${config.model} (attempt ${attempt + 1})`,
            );
          }

          const result = await fn(config);
          if (attempt > 0 || chain[0] !== config) {
            this.logger.log(`AI fallback succeeded: ${config.provider}/${config.model}`);
          }
          return result;
        } catch (err) {
          lastError = err as Error;
          this.logger.warn(
            `AI provider ${config.provider}/${config.model} failed (attempt ${attempt + 1}): ${lastError.message}`,
          );
          // On non-retriable errors (e.g., auth), skip retries
          if (this.isNonRetriable(lastError)) break;
        }
      }
    }

    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
  }

  private isNonRetriable(err: Error): boolean {
    const message = err.message.toLowerCase();
    return (
      message.includes('api key') ||
      message.includes('authentication') ||
      message.includes('invalid_api_key') ||
      message.includes('not configured')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  getFeatureConfigs(): AiFeatureConfig[] {
    return Array.from(this.featureConfigs.values());
  }
}
