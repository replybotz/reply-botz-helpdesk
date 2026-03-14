import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IAiProvider,
  AiChatRequest,
  AiChatResponse,
} from '../interfaces/ai-provider.interface';

/**
 * OpenRouter provider — acts as a proxy to hundreds of AI models.
 * Uses OpenAI-compatible API.
 */
@Injectable()
export class OpenRouterProvider implements IAiProvider {
  readonly name = 'openrouter';
  readonly supportedModels = ['*']; // Supports all models via proxy

  private readonly logger = new Logger(OpenRouterProvider.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://replybotz.com',
          'X-Title': 'Reply Botz Helpdesk',
        },
      });
    }
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    if (!this.client) throw new Error('OpenRouter API key not configured');

    const model = request.model ?? 'anthropic/claude-3.5-sonnet';
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

  async isAvailable(): Promise<boolean> {
    return !!this.client;
  }
}
