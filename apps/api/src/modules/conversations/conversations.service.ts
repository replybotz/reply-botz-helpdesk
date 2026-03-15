import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConversationChannel,
  ConversationStatus,
  MessageSenderType,
  UserRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { EVENTS } from '../../shared/events/events.module';
import { AiMessage } from '../ai-gateway/interfaces/ai-provider.interface';

export interface CreateConversationDto {
  customerId?: string;
  organizationId: string;
  channel: ConversationChannel;
  lmsUserId?: string;
  lmsPlatform?: string;
  lmsCourseId?: string;
  lmsAssignmentId?: string;
  userRole?: string;
  contentModerationEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateConversationDto {
  status?: ConversationStatus;
  assignedAgentId?: string;
  aiModelConfig?: Record<string, unknown>;
  contentModerationEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ConversationFilters {
  status?: ConversationStatus;
  assignedAgentId?: string;
  customerId?: string;
  channel?: ConversationChannel;
  page?: number;
  limit?: number;
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateConversationDto, actorId?: string) {
    this.logger.log(
      `Creating conversation for org=${dto.organizationId} channel=${dto.channel}`,
    );

    let customerId = dto.customerId;

    if (!customerId && dto.lmsUserId) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: {
          organizationId: dto.organizationId,
          lmsUserId: dto.lmsUserId,
          ...(dto.lmsPlatform ? { lmsPlatform: dto.lmsPlatform } : {}),
        },
      });

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const newCustomer = await this.prisma.customer.create({
          data: {
            organizationId: dto.organizationId,
            lmsUserId: dto.lmsUserId,
            lmsPlatform: dto.lmsPlatform,
            role: (dto.userRole as UserRole | undefined) ?? UserRole.STUDENT,
            metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
        customerId = newCustomer.id;
        this.logger.log(`Auto-created customer id=${customerId} for lmsUserId=${dto.lmsUserId}`);
      }
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        organizationId: dto.organizationId,
        customerId,
        channel: dto.channel,
        lmsUserId: dto.lmsUserId,
        lmsPlatform: dto.lmsPlatform,
        lmsCourseId: dto.lmsCourseId,
        lmsAssignmentId: dto.lmsAssignmentId,
        userRole: dto.userRole as any,
        contentModerationEnabled: dto.contentModerationEnabled ?? true,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        status: ConversationStatus.ACTIVE,
      },
      include: {
        customer: true,
        assignedAgent: true,
      },
    });

    this.eventEmitter.emit(EVENTS.CONVERSATION_CREATED, {
      conversation,
      actorId,
    });

    this.logger.log(`Conversation created id=${conversation.id}`);
    return conversation;
  }

  async findAll(organizationId: string, filters: ConversationFilters = {}) {
    const { status, assignedAgentId, customerId, channel, page = 1, limit = 20 } = filters;

    const where: Prisma.ConversationWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(assignedAgentId ? { assignedAgentId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(channel ? { channel } : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          customer: true,
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, organizationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const conversationWithMessages = conversation as typeof conversation & {
      messages: { id: string; content: string; createdAt: Date; [key: string]: unknown }[];
    };

    return {
      ...conversationWithMessages,
      messages: [...conversationWithMessages.messages].reverse(),
    };
  }

  async update(id: string, dto: UpdateConversationDto, actorId?: string) {
    const existing = await this.prisma.conversation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assignedAgentId !== undefined ? { assignedAgentId: dto.assignedAgentId } : {}),
        ...(dto.aiModelConfig !== undefined
          ? { aiModelConfig: dto.aiModelConfig as Prisma.InputJsonValue }
          : {}),
        ...(dto.contentModerationEnabled !== undefined
          ? { contentModerationEnabled: dto.contentModerationEnabled }
          : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as Prisma.InputJsonValue }
          : {}),
      },
      include: {
        customer: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  async resolve(id: string, actorId?: string) {
    const existing = await this.prisma.conversation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const resolved = await this.prisma.conversation.update({
      where: { id },
      data: { status: ConversationStatus.RESOLVED },
    });

    this.eventEmitter.emit('conversation.resolved', {
      conversation: resolved,
      actorId,
    });

    this.logger.log(`Conversation ${id} resolved by actorId=${actorId}`);
    return resolved;
  }

  async close(id: string, actorId?: string) {
    const existing = await this.prisma.conversation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const closed = await this.prisma.conversation.update({
      where: { id },
      data: { status: ConversationStatus.CLOSED },
    });

    this.logger.log(`Conversation ${id} closed by actorId=${actorId}`);
    return closed;
  }

  async getConversationContext(conversationId: string): Promise<AiMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    messages.reverse();

    return messages.map((msg) => {
      let role: 'user' | 'assistant' | 'system';
      switch (msg.senderType) {
        case MessageSenderType.CUSTOMER:
          role = 'user';
          break;
        case MessageSenderType.AI:
          role = 'assistant';
          break;
        case MessageSenderType.AGENT:
          role = 'assistant';
          break;
        case MessageSenderType.SYSTEM:
          role = 'system';
          break;
        default:
          role = 'user';
      }
      return { role, content: msg.content };
    });
  }
}
