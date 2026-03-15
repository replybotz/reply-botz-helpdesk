import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MessageSenderType,
  MessageContentType,
  ModerationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { ContentModerationService } from '../content-moderation/content-moderation.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { ConversationsService } from './conversations.service';
import { EVENTS } from '../../shared/events/events.module';

export interface SendMessageDto {
  conversationId: string;
  content: string;
  senderType: MessageSenderType;
  senderId?: string;
  contentType?: MessageContentType;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentModeration: ContentModerationService,
    private readonly aiGateway: AiGatewayService,
    private readonly conversationsService: ConversationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async sendMessage(dto: SendMessageDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderType: dto.senderType,
        senderId: dto.senderId,
        content: dto.content,
        contentType: dto.contentType ?? MessageContentType.TEXT,
        moderationStatus: ModerationStatus.PENDING,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    if (
      conversation.contentModerationEnabled &&
      dto.senderType === MessageSenderType.CUSTOMER
    ) {
      let finalModerationStatus: ModerationStatus = ModerationStatus.APPROVED;

      try {
        const moderationResult = await this.contentModeration.moderate({
          content: dto.content,
          messageId: userMessage.id,
          conversationId: dto.conversationId,
          organizationId: conversation.organizationId,
          senderType: dto.senderType,
        });

        if (moderationResult.action === 'block') {
          finalModerationStatus = ModerationStatus.BLOCKED;
        } else if (moderationResult.action === 'flag') {
          finalModerationStatus = ModerationStatus.FLAGGED;
        } else {
          finalModerationStatus = ModerationStatus.APPROVED;
        }

        await this.prisma.message.update({
          where: { id: userMessage.id },
          data: {
            moderationStatus: finalModerationStatus,
            moderationFlags: moderationResult as unknown as Prisma.InputJsonValue,
          },
        });

        if (moderationResult.action === 'block') {
          this.eventEmitter.emit(EVENTS.CHAT_MESSAGE_RECEIVED, {
            message: { ...userMessage, moderationStatus: ModerationStatus.BLOCKED },
            blocked: true,
            conversationId: dto.conversationId,
          });
          return {
            userMessage: { ...userMessage, moderationStatus: ModerationStatus.BLOCKED },
            blocked: true,
          };
        }
      } catch (err) {
        this.logger.error(`Content moderation failed for message ${userMessage.id}`, err);
        await this.prisma.message.update({
          where: { id: userMessage.id },
          data: { moderationStatus: ModerationStatus.APPROVED },
        });
      }
    } else if (dto.senderType !== MessageSenderType.CUSTOMER) {
      await this.prisma.message.update({
        where: { id: userMessage.id },
        data: { moderationStatus: ModerationStatus.APPROVED },
      });
    }

    const updatedUserMessage = await this.prisma.message.findUnique({
      where: { id: userMessage.id },
    });

    this.eventEmitter.emit(EVENTS.CHAT_MESSAGE_RECEIVED, {
      message: updatedUserMessage,
      conversationId: dto.conversationId,
    });

    let aiMessage = null;

    const aiHandled = dto.senderType === MessageSenderType.CUSTOMER && !conversation.assignedAgentId;

    if (aiHandled) {
      try {
        const context = await this.conversationsService.getConversationContext(dto.conversationId);
        const messagesForAi = [
          ...context,
          { role: 'user' as const, content: dto.content },
        ];

        const aiResponse = await this.aiGateway.chat({ messages: messagesForAi }, 'chat');

        aiMessage = await this.prisma.message.create({
          data: {
            conversationId: dto.conversationId,
            senderType: MessageSenderType.AI,
            content: aiResponse.content,
            contentType: MessageContentType.TEXT,
            moderationStatus: ModerationStatus.APPROVED,
            metadata: {
              provider: aiResponse.provider,
              model: aiResponse.model,
              tokensUsed: aiResponse.tokensUsed,
            } as Prisma.InputJsonValue,
          },
        });

        this.eventEmitter.emit(EVENTS.CHAT_AI_RESPONSE_GENERATED, {
          message: aiMessage,
          conversationId: dto.conversationId,
        });

        this.logger.log(
          `AI response generated for conversation=${dto.conversationId} provider=${aiResponse.provider}`,
        );
      } catch (err) {
        this.logger.error(
          `AI response generation failed for conversation=${dto.conversationId}`,
          err,
        );
      }
    }

    return {
      userMessage: updatedUserMessage,
      aiMessage,
    };
  }

  async getMessages(conversationId: string, before?: Date, limit = 50) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(before ? { createdAt: { lt: before } } : {}),
    };

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse();
  }
}
