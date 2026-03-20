import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { errorResponse } from '@/lib/errors';

export const GET = withPermission(
  Permission.ANALYTICS_READ,
  async (_req: Request, ctx: RouteContext) => {
    try {
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        urgentTickets,
        totalConversations,
        activeConversations,
        totalArticles,
        publishedArticles,
        totalUsers,
        activeAgents,
        recentTickets,
      ] = await Promise.all([
        db.ticket.count(),
        db.ticket.count({ where: { status: 'OPEN' } }),
        db.ticket.count({ where: { status: 'IN_PROGRESS' } }),
        db.ticket.count({ where: { status: 'RESOLVED' } }),
        db.ticket.count({ where: { priority: 'URGENT' } }),
        db.conversation.count(),
        db.conversation.count({
          where: { status: { in: ['OPEN', 'ASSIGNED'] } },
        }),
        db.knowledgeBaseArticle.count(),
        db.knowledgeBaseArticle.count({ where: { status: 'PUBLISHED' } }),
        db.user.count(),
        db.user.count({ where: { role: { in: ['AGENT', 'SUPERVISOR'] }, status: 'ACTIVE' } }),
        db.ticket.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
            assignee: { select: { displayName: true } },
          },
        }),
      ]);

      return Response.json({
        tickets: {
          total: totalTickets,
          open: openTickets,
          inProgress: inProgressTickets,
          resolved: resolvedTickets,
          urgent: urgentTickets,
        },
        conversations: {
          total: totalConversations,
          active: activeConversations,
        },
        knowledgeBase: {
          total: totalArticles,
          published: publishedArticles,
        },
        users: {
          total: totalUsers,
          activeAgents,
        },
        recentTickets,
      });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
