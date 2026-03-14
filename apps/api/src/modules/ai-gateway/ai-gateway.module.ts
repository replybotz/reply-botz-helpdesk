import { Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { AiGatewayController } from './ai-gateway.controller';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';

@Module({
  controllers: [AiGatewayController],
  providers: [
    AiGatewayService,
    OpenAiProvider,
    AnthropicProvider,
    GoogleProvider,
    OpenRouterProvider,
  ],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}
