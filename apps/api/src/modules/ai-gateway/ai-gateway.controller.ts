import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AiGatewayService } from './ai-gateway.service';
import { AiChatRequest } from './interfaces/ai-provider.interface';

@ApiTags('AI Gateway')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiGatewayController {
  constructor(private readonly aiGatewayService: AiGatewayService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a chat message through the AI gateway' })
  async chat(
    @Body()
    body: {
      request: AiChatRequest;
      feature?: string;
      provider?: string;
      model?: string;
    },
  ) {
    return this.aiGatewayService.chat(
      body.request,
      body.feature ?? 'chat',
      body.provider,
      body.model,
    );
  }

  @Post('embed')
  @ApiOperation({ summary: 'Generate embeddings' })
  async embed(@Body() body: { text: string | string[]; model?: string }) {
    return this.aiGatewayService.embed({ text: body.text, model: body.model });
  }

  @Post('moderate')
  @ApiOperation({ summary: 'Run content moderation' })
  async moderate(@Body() body: { input: string }) {
    return this.aiGatewayService.moderate({ input: body.input });
  }

  @Get('providers')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List configured AI providers' })
  async getProviders() {
    return {
      providers: this.aiGatewayService.getProviderNames(),
      features: this.aiGatewayService.getFeatureConfigs(),
    };
  }
}
