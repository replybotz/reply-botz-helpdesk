import type { z } from 'zod';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateTextParams {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface GenerateObjectParams<T> {
  system: string;
  messages: ChatMessage[];
  /** Validated against the provider's response; also drives native schema enforcement where supported. */
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
}

/** Uniform surface every provider adapter implements. */
export interface AiProvider {
  readonly providerId: ProviderId;
  readonly model: string;
  generateText(params: GenerateTextParams): Promise<string>;
  generateObject<T>(params: GenerateObjectParams<T>): Promise<T>;
}

/**
 * How a provider is talked to. `anthropic` uses the official Anthropic SDK;
 * `openai-compatible` covers every vendor exposing an OpenAI-shaped
 * `/chat/completions` endpoint, which is the majority of the ecosystem.
 */
export type ProviderKind = 'anthropic' | 'openai-compatible';

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'google'
  | 'ollama'
  | 'azure-openai'
  | 'groq'
  | 'mistral'
  | 'deepseek'
  | 'together'
  | 'xai'
  | 'openai-compatible';

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  /** Sensible default model; tenants may override per configuration. */
  defaultModel: string;
  /** Fixed endpoint, or undefined when the operator must supply one. */
  baseUrl?: string;
  requiresApiKey: boolean;
  /** True when the operator must provide `settings.baseUrl`. */
  requiresBaseUrl?: boolean;
  /** Native JSON-schema enforcement. When false, the schema is described in the prompt and validated client-side. */
  supportsJsonSchema: boolean;
  notes?: string;
}

/**
 * Provider registry. Adding a vendor that speaks the OpenAI protocol is a
 * single entry here — no adapter code required.
 */
export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    kind: 'anthropic',
    defaultModel: 'claude-opus-5',
    requiresApiKey: true,
    supportsJsonSchema: true,
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    kind: 'openai-compatible',
    defaultModel: 'gpt-5',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    supportsJsonSchema: true,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    defaultModel: 'anthropic/claude-opus-5',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    supportsJsonSchema: true,
    notes: 'Schema support depends on the routed model.',
  },
  google: {
    id: 'google',
    label: 'Gemini (Google)',
    kind: 'openai-compatible',
    defaultModel: 'gemini-2.5-pro',
    // Google's documented OpenAI-compatibility layer.
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    requiresApiKey: true,
    supportsJsonSchema: true,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (self-hosted)',
    kind: 'openai-compatible',
    defaultModel: 'llama3.1',
    baseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    supportsJsonSchema: false,
    notes: 'Override the base URL when Ollama runs outside this host.',
  },
  'azure-openai': {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    kind: 'openai-compatible',
    defaultModel: 'gpt-5',
    requiresApiKey: true,
    requiresBaseUrl: true,
    supportsJsonSchema: true,
    notes: 'Base URL is your deployment endpoint.',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    kind: 'openai-compatible',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    supportsJsonSchema: true,
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai-compatible',
    defaultModel: 'mistral-large-latest',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    supportsJsonSchema: true,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    supportsJsonSchema: false,
  },
  together: {
    id: 'together',
    label: 'Together AI',
    kind: 'openai-compatible',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
    supportsJsonSchema: true,
  },
  xai: {
    id: 'xai',
    label: 'xAI (Grok)',
    kind: 'openai-compatible',
    defaultModel: 'grok-4',
    baseUrl: 'https://api.x.ai/v1',
    requiresApiKey: true,
    supportsJsonSchema: true,
  },
  'openai-compatible': {
    id: 'openai-compatible',
    label: 'Custom (OpenAI-compatible)',
    kind: 'openai-compatible',
    defaultModel: '',
    requiresApiKey: false,
    requiresBaseUrl: true,
    supportsJsonSchema: false,
    notes: 'For vLLM, LM Studio, LiteLLM, or any self-hosted OpenAI-shaped endpoint.',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS;
}
