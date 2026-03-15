import { Injectable, Logger } from '@nestjs/common';
import {
  ConversationStatus,
  TicketStatus,
  TicketPriority,
  KbArticleStatus,
  MessageSenderType,
} from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

function periodToDays(period: AnalyticsPeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
  }
}

function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(organizationId: string) {
    this.logger.debug(`Building dashboard stats for org ${organizationId}`);

    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const thirtyDaysAgo = subtractDays(now, 30);
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      totalConversations,
      activeConversations,
      resolvedConversations,
      todayConversations,
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      todayTickets,
      lowPriorityTickets,
      normalPriorityTickets,
      highPriorityTickets,
      urgentPriorityTickets,
      totalCustomers,
      newThisMonthCustomers,
      totalKbArticles,
      publishedKbArticles,
      draftKbArticles,
      totalLmsIntegrations,
      enabledLmsIntegrations,
      totalUsers,
      activeUsers,
      recentConversations,
      recentTickets,
      aiMessagesLast30Days,
    ] = await Promise.all([
      // Conversations
      this.prisma.conversation.count({ where: { organizationId } }),
      this.prisma.conversation.count({ where: { organizationId, status: ConversationStatus.ACTIVE } }),
      this.prisma.conversation.count({ where: { organizationId, status: ConversationStatus.RESOLVED } }),
      this.prisma.conversation.count({ where: { organizationId, createdAt: { gte: todayStart } } }),

      // Tickets
      this.prisma.ticket.count({ where: { organizationId } }),
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.OPEN } }),
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.IN_PROGRESS } }),
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.RESOLVED } }),
      this.prisma.ticket.count({ where: { organizationId, status: TicketStatus.CLOSED } }),
      this.prisma.ticket.count({ where: { organizationId, createdAt: { gte: todayStart } } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.LOW } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.NORMAL } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.HIGH } }),
      this.prisma.ticket.count({ where: { organizationId, priority: TicketPriority.URGENT } }),

      // Customers
      this.prisma.customer.count({ where: { organizationId } }),
      this.prisma.customer.count({ where: { organizationId, createdAt: { gte: firstOfMonth } } }),

      // KB articles
      this.prisma.kbArticle.count({ where: { organizationId } }),
      this.prisma.kbArticle.count({ where: { organizationId, status: KbArticleStatus.PUBLISHED } }),
      this.prisma.kbArticle.count({ where: { organizationId, status: KbArticleStatus.DRAFT } }),

      // LMS integrations
      this.prisma.lmsIntegration.count({ where: { organizationId } }),
      this.prisma.lmsIntegration.count({ where: { organizationId, syncEnabled: true } }),

      // Users
      this.prisma.user.count({ where: { organizationId } }),
      this.prisma.user.count({ where: { organizationId, isActive: true } }),

      // Recent activity — last 5 each
      this.prisma.conversation.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.ticket.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // AI usage — count AI messages in last 30 days
      this.prisma.message.count({
        where: {
          senderType: MessageSenderType.AI,
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId },
        },
      }),
    ]);

    return {
      conversations: {
        total: totalConversations,
        active: activeConversations,
        resolved: resolvedConversations,
        today: todayConversations,
      },
      tickets: {
        total: totalTickets,
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets,
        today: todayTickets,
        byPriority: {
          low: lowPriorityTickets,
          normal: normalPriorityTickets,
          high: highPriorityTickets,
          urgent: urgentPriorityTickets,
        },
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newThisMonthCustomers,
      },
      kbArticles: {
        total: totalKbArticles,
        published: publishedKbArticles,
        draft: draftKbArticles,
      },
      lmsIntegrations: {
        total: totalLmsIntegrations,
        enabled: enabledLmsIntegrations,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      recentActivity: {
        conversations: recentConversations,
        tickets: recentTickets,
      },
      aiUsage: {
        messagesProcessed: aiMessagesLast30Days,
      },
    };
  }

  async getConversationMetrics(organizationId: string, period: AnalyticsPeriod) {
    this.logger.debug(`Getting conversation metrics for org ${organizationId}, period ${period}`);

    const days = periodToDays(period);
    const now = new Date();
    const periodStart = subtractDays(startOfDayUTC(now), days - 1);

    const conversations = await this.prisma.conversation.findMany({
      where: { organizationId, createdAt: { gte: periodStart } },
      include: { _count: { select: { messages: true } } },
    });

    const dailyCounts = new Map<string, { total: number; resolved: number; messages: number }>();
    for (let i = 0; i < days; i++) {
      const d = subtractDays(now, days - 1 - i);
      dailyCounts.set(d.toISOString().slice(0, 10), { total: 0, resolved: 0, messages: 0 });
    }

    for (const conv of conversations) {
      const key = conv.createdAt.toISOString().slice(0, 10);
      const day = dailyCounts.get(key);
      if (!day) continue;
      day.total++;
      if (conv.status === ConversationStatus.RESOLVED) day.resolved++;
      day.messages += conv._count.messages;
    }

    const dailyData = Array.from(dailyCounts.entries()).map(([date, counts]) => ({
      date,
      total: counts.total,
      resolved: counts.resolved,
      resolutionRate: counts.total > 0 ? Math.round((counts.resolved / counts.total) * 100) : 0,
      avgMessagesPerConversation:
        counts.total > 0 ? Math.round((counts.messages / counts.total) * 10) / 10 : 0,
    }));

    const totalForPeriod = conversations.length;
    const resolvedForPeriod = conversations.filter(
      (c) => c.status === ConversationStatus.RESOLVED,
    ).length;
    const totalMessages = conversations.reduce((sum, c) => sum + c._count.messages, 0);

    return {
      period,
      daily: dailyData,
      summary: {
        total: totalForPeriod,
        resolved: resolvedForPeriod,
        resolutionRate:
          totalForPeriod > 0 ? Math.round((resolvedForPeriod / totalForPeriod) * 100) : 0,
        avgMessagesPerConversation:
          totalForPeriod > 0 ? Math.round((totalMessages / totalForPeriod) * 10) / 10 : 0,
      },
    };
  }

  async getTicketMetrics(organizationId: string, period: AnalyticsPeriod) {
    this.logger.debug(`Getting ticket metrics for org ${organizationId}, period ${period}`);

    const days = periodToDays(period);
    const now = new Date();
    const periodStart = subtractDays(startOfDayUTC(now), days - 1);

    const tickets = await this.prisma.ticket.findMany({
      where: { organizationId, createdAt: { gte: periodStart } },
      include: { category: true },
    });

    const dailyCounts = new Map<
      string,
      { total: number; resolved: number; resolutionTimeMs: number; resolvedCount: number }
    >();
    for (let i = 0; i < days; i++) {
      const d = subtractDays(now, days - 1 - i);
      dailyCounts.set(d.toISOString().slice(0, 10), {
        total: 0, resolved: 0, resolutionTimeMs: 0, resolvedCount: 0,
      });
    }

    const categoryDistribution = new Map<string, number>();

    for (const ticket of tickets) {
      const key = ticket.createdAt.toISOString().slice(0, 10);
      const day = dailyCounts.get(key);
      if (day) {
        day.total++;
        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
          day.resolved++;
          day.resolutionTimeMs += ticket.updatedAt.getTime() - ticket.createdAt.getTime();
          day.resolvedCount++;
        }
      }

      const categoryName =
        (ticket.category as { name?: string } | null)?.name ?? 'Uncategorized';
      categoryDistribution.set(categoryName, (categoryDistribution.get(categoryName) ?? 0) + 1);
    }

    const dailyData = Array.from(dailyCounts.entries()).map(([date, counts]) => ({
      date,
      total: counts.total,
      resolved: counts.resolved,
      resolutionRate: counts.total > 0 ? Math.round((counts.resolved / counts.total) * 100) : 0,
      avgResolutionTimeHours:
        counts.resolvedCount > 0
          ? Math.round((counts.resolutionTimeMs / counts.resolvedCount / 3_600_000) * 10) / 10
          : null,
    }));

    const totalResolved = tickets.filter(
      (t) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED,
    );
    const totalResolutionMs = totalResolved.reduce(
      (sum, t) => sum + (t.updatedAt.getTime() - t.createdAt.getTime()),
      0,
    );

    return {
      period,
      daily: dailyData,
      summary: {
        total: tickets.length,
        resolved: totalResolved.length,
        resolutionRate:
          tickets.length > 0 ? Math.round((totalResolved.length / tickets.length) * 100) : 0,
        avgResolutionTimeHours:
          totalResolved.length > 0
            ? Math.round((totalResolutionMs / totalResolved.length / 3_600_000) * 10) / 10
            : null,
      },
      byCategory: Array.from(categoryDistribution.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async getTopKbArticles(organizationId: string, limit = 10) {
    this.logger.debug(`Getting top KB articles for org ${organizationId}`);

    const articles = await this.prisma.kbArticle.findMany({
      where: { organizationId, status: KbArticleStatus.PUBLISHED },
      orderBy: { viewCount: 'desc' },
      take: limit,
      include: { category: true },
    });

    return articles.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      viewCount: a.viewCount,
      helpfulCount: a.helpfulCount,
      notHelpfulCount: a.notHelpfulCount,
      helpfulRate:
        a.helpfulCount + a.notHelpfulCount > 0
          ? Math.round((a.helpfulCount / (a.helpfulCount + a.notHelpfulCount)) * 100)
          : null,
      category: a.category,
      tags: a.tags,
      publishedAt: a.publishedAt,
    }));
  }

  // Legacy helpers kept for backwards-compatible controller endpoints
  async getTicketTrends(organizationId: string, days = 30) {
    const startDate = subtractDays(new Date(), days);
    const tickets = await this.prisma.ticket.findMany({
      where: { organizationId, createdAt: { gte: startDate } },
      select: { createdAt: true, status: true, priority: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate: Record<string, { created: number; resolved: number }> = {};
    for (const ticket of tickets) {
      const date = ticket.createdAt.toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = { created: 0, resolved: 0 };
      byDate[date].created++;
      if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
        byDate[date].resolved++;
      }
    }
    return Object.entries(byDate).map(([date, counts]) => ({ date, ...counts }));
  }

  async getAgentPerformance(organizationId: string) {
    const agents = await this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        role: true,
        _count: { select: { assignedTickets: true } },
      },
    });

    return Promise.all(
      agents.map(async (agent) => {
        const resolvedCount = await this.prisma.ticket.count({
          where: {
            organizationId,
            assignedAgentId: agent.id,
            status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          },
        });

        const resolvedWithTime = await this.prisma.ticket.findMany({
          where: { organizationId, assignedAgentId: agent.id, resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
        });

        let avgResolutionTimeHours: number | null = null;
        if (resolvedWithTime.length > 0) {
          const totalMs = resolvedWithTime.reduce(
            (sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()),
            0,
          );
          avgResolutionTimeHours = totalMs / resolvedWithTime.length / 3_600_000;
        }

        return {
          agentId: agent.id,
          name: agent.name,
          role: agent.role,
          assignedTickets: agent._count.assignedTickets,
          resolvedTickets: resolvedCount,
          avgResolutionTimeHours,
        };
      }),
    );
  }

  async getKbStats(organizationId: string) {
    const [articles, totalArticles] = await Promise.all([
      this.prisma.kbArticle.findMany({
        where: { organizationId },
        select: {
          id: true,
          title: true,
          viewCount: true,
          helpfulCount: true,
          notHelpfulCount: true,
          status: true,
        },
        orderBy: { viewCount: 'desc' },
        take: 10,
      }),
      this.prisma.kbArticle.count({ where: { organizationId } }),
    ]);

    const totalViews = articles.reduce((sum, a) => sum + (a.viewCount ?? 0), 0);
    return { totalArticles, totalViews, topArticles: articles };
  }

  async getLmsStats(organizationId: string) {
    const integrations = await this.prisma.lmsIntegration.findMany({
      where: { organizationId },
      select: {
        id: true,
        lmsPlatform: true,
        syncEnabled: true,
        lastSyncAt: true,
        _count: { select: { lmsUsers: true, lmsCourses: true } },
      },
    });

    return integrations.map((i) => ({
      platform: i.lmsPlatform,
      syncEnabled: i.syncEnabled,
      lastSyncAt: i.lastSyncAt,
      userCount: i._count.lmsUsers,
      courseCount: i._count.lmsCourses,
    }));
  }
}
