import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext, type RouteHandlerContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { enqueueAiJob } from '@/lib/queue/ai-queue';
import { errorResponse, NotFoundError } from '@/lib/errors';

/** Latest triage result for this ticket, if any. */
export const GET = withPermission(
  Permission.TICKET_READ,
  async (_req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
    try {
      const { id: ticketId } = await routeCtx.params;
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const suggestion = await db.aiSuggestion.findFirst({
        where: { ticketId, kind: 'TRIAGE' },
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ suggestion });
    } catch (error) {
      return errorResponse(error);
    }
  },
);

/** Queue AI triage for this ticket. Classification happens in the AI worker. */
export const POST = withPermission(
  Permission.TICKET_UPDATE,
  async (_req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
    try {
      const { id: ticketId } = await routeCtx.params;
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const ticket = await db.ticket.findFirst({
        where: { id: ticketId },
        select: { id: true },
      });
      if (!ticket) throw new NotFoundError('Ticket');

      const suggestion = await db.aiSuggestion.create({
        data: {
          tenantId: ctx.tenantId,
          kind: 'TRIAGE',
          status: 'PENDING',
          ticketId,
          requestedBy: ctx.userId,
        },
      });

      await enqueueAiJob({
        type: 'triage-ticket',
        tenantId: ctx.tenantId,
        ticketId,
        suggestionId: suggestion.id,
      });

      return Response.json(suggestion, { status: 202 });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
