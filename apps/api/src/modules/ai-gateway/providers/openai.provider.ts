import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IAiProvider,
  AiChatRequest,
  AiChatResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiModerationRequest,
  AiModerationResponse,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  readonly name = 'openai';
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'text-embedding-3-small',
    'text-embedding-3-large',
    'text-moderation-latest',
  ];

  private readonly logger = new Logger(OpenAiProvider.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    if (!this.client) throw new Error('OpenAI API key not configured');

    const model = request.model ?? 'gpt-4o';
    const response = await this.client.chat.completions.create({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content ?? '',
      provider: this.name,
      model,
      tokensUsed: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? undefined,
    };
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    if (!this.client) throw new Error('OpenAI API key not configured');

    const model = request.model ?? 'text-embedding-3-small';
    const input = Array.isArray(request.text) ? request.text : [request.text];

    const response = await this.client.embeddings.create({ model, input });

    return {
      embeddings: response.data.map((d) => d.embedding),
      provider: this.name,
      model,
      tokensUsed: response.usage.total_tokens,
    };
  }

  async moderate(request: AiModerationRequest): Promise<AiModerationResponse> {
    if (!this.client) throw new Error('OpenAI API key not configured');

    const response = await this.client.moderations.create({
      input: request.input,
      model: 'text-moderation-latest',
    });

    const result = response.results[0];
    return {
      flagged: result.flagged,
      categories: result.categories as unknown as Record<string, boolean>,
      categoryScores: result.category_scores as unknown as Record<string, number>,
      provider: this.name,
      model: 'text-moderation-latest',
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
