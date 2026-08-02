import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext, type RouteHandlerContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { enqueueAiJob } from '@/lib/queue/ai-queue';
import { errorResponse, NotFoundError } from '@/lib/errors';

/** Latest drafted reply for this conversation, if any. */
export const GET = withPermission(
  Permission.CONVERSATION_READ,
  async (_req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
    try {
      const { id: conversationId } = await routeCtx.params;
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const suggestion = await db.aiSuggestion.findFirst({
        where: { conversationId, kind: 'REPLY' },
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ suggestion });
    } catch (error) {
      return errorResponse(error);
    }
  },
);

/** Queue a drafted reply. Generation happens in the AI worker. */
export const POST = withPermission(
  Permission.CONVERSATION_CREATE,
  async (_req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
    try {
      const { id: conversationId } = await routeCtx.params;
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      // Customers never draft agent replies, and the conversation must belong
      // to this tenant.
      if (ctx.role === 'CUSTOMER') {
        throw new NotFoundError('Conversation');
      }
      const conversation = await db.conversation.findFirst({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!conversation) throw new NotFoundError('Conversation');

      const suggestion = await db.aiSuggestion.create({
        data: {
          tenantId: ctx.tenantId,
          kind: 'REPLY',
          status: 'PENDING',
          conversationId,
          requestedBy: ctx.userId,
        },
      });

      await enqueueAiJob({
        type: 'draft-reply',
        tenantId: ctx.tenantId,
        conversationId,
        suggestionId: suggestion.id,
      });

      return Response.json(suggestion, { status: 202 });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
