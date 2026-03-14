import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  IAiProvider,
  AiChatRequest,
  AiChatResponse,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class GoogleProvider implements IAiProvider {
  readonly name = 'google';
  readonly supportedModels = [
    'gemini-2.0-flash',
    'gemini-2.5-pro-preview-06-05',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ];

  private readonly logger = new Logger(GoogleProvider.name);
  private client: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    if (!this.client) throw new Error('Google AI API key not configured');

    const model = request.model ?? 'gemini-2.0-flash';
    const genModel = this.client.getGenerativeModel({
      model,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    });

    // Extract system message
    const systemMsg = request.messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = request.messages.filter((m) => m.role !== 'system');

    // Map to Google's format
    const history = conversationMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = conversationMessages[conversationMessages.length - 1];

    const chat = genModel.startChat({
      history,
      systemInstruction: systemMsg,
    });

    const result = await chat.sendMessage(lastMessage?.content ?? '');
    const response = result.response;

    return {
      content: response.text(),
      provider: this.name,
      model,
      tokensUsed: {
        prompt: response.usageMetadata?.promptTokenCount ?? 0,
        completion: response.usageMetadata?.candidatesTokenCount ?? 0,
        total: response.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await model.generateContent('test');
      return true;
    } catch {
      return false;
    }
  }
}
