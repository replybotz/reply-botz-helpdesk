import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  IAiProvider,
  AiChatRequest,
  AiChatResponse,
  AiMessage,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class AnthropicProvider implements IAiProvider {
  readonly name = 'anthropic';
  readonly supportedModels = [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ];

  private readonly logger = new Logger(AnthropicProvider.name);
  private client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    if (!this.client) throw new Error('Anthropic API key not configured');

    const model = request.model ?? 'claude-sonnet-4-6';

    // Extract system message and user/assistant messages
    const systemMessages = request.messages.filter((m): m is AiMessage & { role: 'system' } =>
      m.role === 'system',
    );
    const conversationMessages = request.messages.filter((m) => m.role !== 'system');
    const system = systemMessages.map((m) => m.content).join('\n\n');

    const response = await this.client.messages.create({
      model,
      system: system || undefined,
      messages: conversationMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    });

    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : '',
      provider: this.name,
      model,
      tokensUsed: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? undefined,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      // Quick validation using a minimal message
      await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
