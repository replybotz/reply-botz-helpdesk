export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AiChatResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason?: string;
}

export interface AiEmbeddingRequest {
  text: string | string[];
  model?: string;
}

export interface AiEmbeddingResponse {
  embeddings: number[][];
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface AiModerationRequest {
  input: string;
}

export interface AiModerationResponse {
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  provider: string;
  model: string;
}

export interface IAiProvider {
  readonly name: string;
  readonly supportedModels: string[];

  chat(request: AiChatRequest): Promise<AiChatResponse>;
  embed?(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse>;
  moderate?(request: AiModerationRequest): Promise<AiModerationResponse>;
  isAvailable(): Promise<boolean>;
}

export interface AiProviderConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiFeatureConfig {
  feature: string;
  primary: AiProviderConfig;
  fallbackChain: AiProviderConfig[];
}
