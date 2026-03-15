import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketStatus, TicketPriority, TicketSource, UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from '../ferpa-compliance/encryption.service';
import { FerpaAuditService } from '../ferpa-compliance/ferpa-audit.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';

export interface CreateTicketDto {
  subject: string;
  description?: string;
  customerId?: string;
  organizationId: string;
  lmsUserId?: string;
  lmsPlatform?: string;
  lmsCourseId?: string;
  lmsAssignmentId?: string;
  userRole?: UserRole;
  priority?: TicketPriority;
  categoryId?: string;
  source?: TicketSource;
  metadata?: Record<string, unknown>;
}

export interface UpdateTicketDto {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAgentId?: string;
  categoryId?: string;
  description?: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAgentId?: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface AiClassification {
  category: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  summary: string;
  confidence: number;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly ferpaAudit: FerpaAuditService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async create(dto: CreateTicketDto, actorId?: string) {
    this.logger.log(
      `Creating ticket subject="${dto.subject}" org=${dto.organizationId}`,
    );

    const ticket = await this.prisma.ticket.create({
      data: {
        subject: dto.subject,
        description: dto.description,
        organizationId: dto.organizationId,
        customerId: dto.customerId,
        lmsUserId: dto.lmsUserId,
        lmsPlatform: dto.lmsPlatform,
        lmsCourseId: dto.lmsCourseId,
        lmsAssignmentId: dto.lmsAssignmentId,
        userRole: dto.userRole,
        priority: dto.priority ?? TicketPriority.NORMAL,
        status: TicketStatus.OPEN,
        source: dto.source ?? TicketSource.MANUAL,
        categoryId: dto.categoryId,
        externalRefs: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Ticket created id=${ticket.id}, running AI classification`);

    // AI classification (non-blocking — errors are logged, not thrown)
    try {
      const classificationResponse = await this.aiGateway.chat(
        {
          messages: [
            {
              role: 'system',
              content:
                'You are a support ticket classifier. Given a ticket subject and description, return a JSON object with: {category: string, priority: \'LOW\'|\'NORMAL\'|\'HIGH\'|\'URGENT\', summary: string, confidence: number}',
            },
            {
              role: 'user',
              content: `Subject: ${dto.subject}\nDescription: ${dto.description ?? ''}`,
            },
          ],
        },
        'ticket',
      );

      let classification: AiClassification | null = null;
      try {
        // Strip markdown code fences if present
        const raw = classificationResponse.content
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        classification = JSON.parse(raw) as AiClassification;
      } catch {
        this.logger.warn(`Failed to parse AI classification JSON for ticket ${ticket.id}`);
      }

      // AI suggested response
      const suggestedResponse = await this.aiGateway.chat(
        {
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful support agent. Given a support ticket, write a concise, empathetic first response to the customer.',
            },
            {
              role: 'user',
              content: `Subject: ${dto.subject}\nDescription: ${dto.description ?? ''}`,
            },
          ],
        },
        'ticket',
      );

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          aiClassification: (classification ?? {}) as Prisma.InputJsonValue,
          aiSuggestedResponse: suggestedResponse.content,
          aiConfidenceScore: classification?.confidence ?? null,
        },
      });

      this.logger.log(`AI classification stored for ticket ${ticket.id}`);
    } catch (err) {
      this.logger.error(`AI processing failed for ticket ${ticket.id}: ${(err as Error).message}`);
    }

    // FERPA audit for student tickets
    if (dto.userRole === UserRole.STUDENT) {
      await this.ferpaAudit.log({
        resourceType: 'Ticket',
        resourceId: ticket.id,
        action: 'TICKET_CREATED',
        actorId,
        studentId: dto.lmsUserId ?? dto.customerId,
      });
    }

    return this.findOne(ticket.id, dto.organizationId);
  }

  async findAll(organizationId: string, filters: TicketFilters = {}) {
    const {
      status,
      priority,
      assignedAgentId,
      categoryId,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.TicketWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedAgentId ? { assignedAgentId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
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
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
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
    const ticket = await this.prisma.ticket.findFirst({
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
        category: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, actorId?: string) {
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.assignedAgentId !== undefined
          ? { assignedAgentId: dto.assignedAgentId }
          : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });

    if (dto.status !== undefined && dto.status !== existing.status) {
      await this.prisma.ticketEvent.create({
        data: {
          ticketId: id,
          eventType: 'status_changed',
          actorType: 'agent',
          actorId: actorId ?? null,
          content: `Status changed from ${existing.status} to ${dto.status}`,
          metadata: {
            previousStatus: existing.status,
            newStatus: dto.status,
          } as Prisma.InputJsonValue,
        },
      });
      this.logger.log(
        `Ticket ${id} status changed ${existing.status} -> ${dto.status} by actor=${actorId}`,
      );
    }

    return updated;
  }

  async assign(id: string, agentId: string, actorId?: string) {
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { assignedAgentId: agentId },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        eventType: 'assigned',
        actorType: 'agent',
        actorId: actorId ?? null,
        content: `Ticket assigned to agent ${agentId}`,
        metadata: {
          previousAgentId: existing.assignedAgentId,
          newAgentId: agentId,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Ticket ${id} assigned to agent=${agentId} by actor=${actorId}`);
    return updated;
  }

  async addComment(
    id: string,
    content: string,
    actorType: string,
    actorId?: string,
  ) {
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const event = await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        eventType: 'comment',
        actorType,
        actorId: actorId ?? null,
        content,
        metadata: {} as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Comment added to ticket ${id} by actorType=${actorType} actorId=${actorId}`);
    return event;
  }

  async resolve(id: string, actorId?: string) {
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const now = new Date();
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: now,
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        eventType: 'resolved',
        actorType: 'agent',
        actorId: actorId ?? null,
        content: 'Ticket resolved',
        metadata: { resolvedAt: now.toISOString() } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Ticket ${id} resolved by actor=${actorId}`);
    return updated;
  }

  async close(id: string, actorId?: string) {
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const now = new Date();
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: now,
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        eventType: 'closed',
        actorType: 'agent',
        actorId: actorId ?? null,
        content: 'Ticket closed',
        metadata: { closedAt: now.toISOString() } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Ticket ${id} closed by actor=${actorId}`);
    return updated;
  }

  async getStats(organizationId: string) {
    const [
      totalOpen,
      totalInProgress,
      totalWaitingOnCustomer,
      totalResolved,
      totalClosed,
      totalLow,
      totalNormal,
      totalHigh,
      totalUrgent,
      resolvedTickets,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.OPEN } }),
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.IN_PROGRESS } }),
      this.prisma.ticket.count({
        where: { organizationId, status: TicketStatus.WAITING_ON_CUSTOMER },
      }),
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.RESOLVED } }),
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.CLOSED } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.LOW } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.NORMAL } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.HIGH } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.URGENT } }),
      this.prisma.ticket.findMany({
        where: { organizationId, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    let avgResolutionTimeMs: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalMs = resolvedTickets.reduce((sum, t) => {
        return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgResolutionTimeMs = totalMs / resolvedTickets.length;
    }

    return {
      byStatus: {
        OPEN: totalOpen,
        IN_PROGRESS: totalInProgress,
        WAITING_ON_CUSTOMER: totalWaitingOnCustomer,
        RESOLVED: totalResolved,
        CLOSED: totalClosed,
      },
      byPriority: {
        LOW: totalLow,
        NORMAL: totalNormal,
        HIGH: totalHigh,
        URGENT: totalUrgent,
      },
      avgResolutionTimeMs,
      avgResolutionTimeHours:
        avgResolutionTimeMs !== null ? avgResolutionTimeMs / (1000 * 60 * 60) : null,
    };
  }

  async getCategories(organizationId: string) {
    return this.prisma.ticketCategory.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }
}
