import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { KbArticleStatus, KbArticleSource, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';

export interface CreateKbArticleDto {
  organizationId: string;
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  lmsPlatform?: string;
  targetRole?: UserRole;
  tags?: string[];
  source?: KbArticleSource;
}

export interface UpdateKbArticleDto {
  title?: string;
  content?: string;
  summary?: string;
  categoryId?: string;
  status?: KbArticleStatus;
  targetRole?: UserRole;
  tags?: string[];
}

export interface KbArticleFilters {
  status?: KbArticleStatus;
  categoryId?: string;
  search?: string;
  lmsPlatform?: string;
  targetRole?: UserRole;
  tags?: string[];
  page?: number;
  limit?: number;
}

@Injectable()
export class KbArticlesService {
  private readonly logger = new Logger(KbArticlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async create(dto: CreateKbArticleDto, actorId?: string) {
    this.logger.debug(`Creating KB article "${dto.title}" for org ${dto.organizationId}`);

    const article = await this.prisma.kbArticle.create({
      data: {
        organizationId: dto.organizationId,
        title: dto.title,
        content: dto.content,
        summary: dto.summary,
        categoryId: dto.categoryId,
        lmsPlatform: dto.lmsPlatform,
        targetRole: dto.targetRole,
        tags: dto.tags ?? [],
        source: dto.source ?? KbArticleSource.MANUAL,
        createdBy: actorId,
        status: KbArticleStatus.DRAFT,
        version: 1,
      },
      include: { category: true },
    });

    this.logger.log(`KB article created: ${article.id}`);
    return article;
  }

  async generateFromTicket(ticketId: string, organizationId: string, actorId?: string) {
    this.logger.debug(`Generating KB article from ticket ${ticketId}`);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const systemPrompt = `You are a technical writer creating knowledge base articles for a helpdesk system.
Given a support ticket, generate a clear, helpful knowledge base article that:
1. Has a concise, descriptive title
2. Explains the issue and its solution clearly
3. Is written in a friendly, professional tone
4. Includes a brief summary

Respond in the following JSON format:
{
  "title": "Article title here",
  "summary": "One or two sentence summary",
  "content": "Full article content in markdown format"
}`;

    const userMessage = `Support Ticket:
Subject: ${ticket.subject}
Description: ${ticket.description ?? 'No description provided'}`;

    const response = await this.aiGateway.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.5,
        maxTokens: 3000,
      },
      'kb_generation',
    );

    let parsed: { title: string; summary: string; content: string };
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      this.logger.error(`Failed to parse AI response for ticket ${ticketId}: ${err}`);
      throw new BadRequestException('Failed to generate article from ticket: invalid AI response');
    }

    const article = await this.prisma.kbArticle.create({
      data: {
        organizationId,
        title: parsed.title,
        content: parsed.content,
        summary: parsed.summary,
        source: KbArticleSource.AI_GENERATED,
        sourceTicketId: ticketId,
        createdBy: actorId,
        status: KbArticleStatus.DRAFT,
        tags: [],
        version: 1,
      },
      include: { category: true },
    });

    this.logger.log(`Generated KB article ${article.id} from ticket ${ticketId}`);
    return article;
  }

  async findAll(organizationId: string, filters: KbArticleFilters = {}) {
    const { status, categoryId, search, lmsPlatform, targetRole, tags, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.KbArticleWhereInput = { organizationId };

    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (lmsPlatform) where.lmsPlatform = lmsPlatform;
    if (targetRole) where.targetRole = targetRole;
    if (tags && tags.length > 0) where.tags = { hasSome: tags };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.kbArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.kbArticle.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!article) {
      throw new NotFoundException(`KB article ${id} not found`);
    }

    // Increment view count asynchronously — don't block the response
    this.prisma.kbArticle
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch((err) => this.logger.warn(`Failed to increment viewCount for article ${id}: ${err}`));

    return article;
  }

  async update(id: string, dto: UpdateKbArticleDto, actorId?: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException(`KB article ${id} not found`);

    this.logger.debug(`Updating KB article ${id}${actorId ? ` by ${actorId}` : ''}`);

    const updated = await this.prisma.kbArticle.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.targetRole !== undefined && { targetRole: dto.targetRole }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        version: { increment: 1 },
      },
      include: { category: true },
    });

    this.logger.log(`KB article ${id} updated to version ${updated.version}`);
    return updated;
  }

  async publish(id: string, reviewedBy?: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException(`KB article ${id} not found`);

    const published = await this.prisma.kbArticle.update({
      where: { id },
      data: {
        status: KbArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        ...(reviewedBy && { reviewedBy }),
      },
      include: { category: true },
    });

    this.logger.log(`KB article ${id} published`);
    return published;
  }

  async archive(id: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException(`KB article ${id} not found`);

    const archived = await this.prisma.kbArticle.update({
      where: { id },
      data: { status: KbArticleStatus.ARCHIVED },
      include: { category: true },
    });

    this.logger.log(`KB article ${id} archived`);
    return archived;
  }

  async rateArticle(id: string, helpful: boolean) {
    const article = await this.prisma.kbArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException(`KB article ${id} not found`);

    const updated = await this.prisma.kbArticle.update({
      where: { id },
      data: helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
    });

    return {
      id: updated.id,
      helpfulCount: updated.helpfulCount,
      notHelpfulCount: updated.notHelpfulCount,
    };
  }

  async getCategories(organizationId: string) {
    this.logger.debug(`Fetching KB categories for org ${organizationId}`);
    return this.prisma.kbCategory.findMany({
      where: { organizationId },
      include: { children: true },
      orderBy: { name: 'asc' },
    });
  }
}
