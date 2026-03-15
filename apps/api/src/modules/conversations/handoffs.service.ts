import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { ConversationsService } from './conversations.service';
import { EVENTS } from '../../shared/events/events.module';

export interface RequestHandoffDto {
  conversationId: string;
  fromType: string;
  fromId?: string;
  toAgentId?: string;
  reason?: string;
  contextSummary?: string;
}

@Injectable()
export class HandoffsService {
  private readonly logger = new Logger(HandoffsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly conversationsService: ConversationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestHandoff(dto: RequestHandoffDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    let contextSummary = dto.contextSummary;

    if (!contextSummary) {
      try {
        const context = await this.conversationsService.getConversationContext(dto.conversationId);
        if (context.length > 0) {
          const summaryPrompt = [
            {
              role: 'system' as const,
              content:
                'You are a helpful assistant. Summarize the following conversation in 2-3 sentences for a human agent who is taking over the conversation.',
            },
            ...context,
            {
              role: 'user' as const,
              content: 'Please provide a brief summary of this conversation for a human agent handoff.',
            },
          ];

          const aiResponse = await this.aiGateway.chat({ messages: summaryPrompt }, 'handoff-summary');
          contextSummary = aiResponse.content;
          this.logger.log(`Generated AI context summary for conversation=${dto.conversationId}`);
        }
      } catch (err) {
        this.logger.error(
          `Failed to generate AI context summary for conversation=${dto.conversationId}`,
          err,
        );
      }
    }

    const handoff = await this.prisma.handoff.create({
      data: {
        conversationId: dto.conversationId,
        fromType: dto.fromType,
        fromId: dto.fromId,
        toAgentId: dto.toAgentId,
        reason: dto.reason,
        contextSummary,
        status: 'pending',
      },
    });

    if (dto.toAgentId) {
      await this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { assignedAgentId: dto.toAgentId },
      });
    }

    this.eventEmitter.emit(EVENTS.HANDOFF_REQUESTED, {
      handoff,
      conversation,
    });

    this.logger.log(
      `Handoff requested for conversation=${dto.conversationId} toAgent=${dto.toAgentId ?? 'unassigned'}`,
    );

    return handoff;
  }

  async acceptHandoff(handoffId: string, agentId: string) {
    const handoff = await this.prisma.handoff.findUnique({
      where: { id: handoffId },
    });

    if (!handoff) {
      throw new NotFoundException(`Handoff ${handoffId} not found`);
    }

    const updated = await this.prisma.handoff.update({
      where: { id: handoffId },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        toAgentId: agentId,
      },
    });

    await this.prisma.conversation.update({
      where: { id: handoff.conversationId },
      data: { assignedAgentId: agentId },
    });

    this.eventEmitter.emit(EVENTS.HANDOFF_ACCEPTED, {
      handoff: updated,
      agentId,
    });

    this.logger.log(`Handoff ${handoffId} accepted by agent=${agentId}`);
    return updated;
  }

  async completeHandoff(handoffId: string) {
    const handoff = await this.prisma.handoff.findUnique({
      where: { id: handoffId },
    });

    if (!handoff) {
      throw new NotFoundException(`Handoff ${handoffId} not found`);
    }

    const updated = await this.prisma.handoff.update({
      where: { id: handoffId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    this.eventEmitter.emit(EVENTS.HANDOFF_COMPLETED, {
      handoff: updated,
    });

    this.logger.log(`Handoff ${handoffId} completed`);
    return updated;
  }

  async getHandoffs(organizationId: string, agentId?: string) {
    const where: Prisma.HandoffWhereInput = {
      conversation: {
        organizationId,
      },
      status: 'pending',
      ...(agentId ? { toAgentId: agentId } : {}),
    };

    const handoffs = await this.prisma.handoff.findMany({
      where,
      include: {
        conversation: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return handoffs;
  }
}
