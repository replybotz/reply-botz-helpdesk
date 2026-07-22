import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext, type RouteHandlerContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { sendMessageSchema } from '@/lib/validations/conversations';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';

export const POST = withPermission(
  Permission.CONVERSATION_CREATE,
  async (req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
    try {
      const { id: conversationId } = await routeCtx.params;

      const body = await req.json();
      const parsed = sendMessageSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          'Validation failed',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }

      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const conversation = await db.conversation.findFirst({
        where: { id: conversationId },
      });
      if (!conversation) throw new NotFoundError('Conversation');

      // Provenance is derived from the authenticated role, never from the
      // request body — AI/SYSTEM messages are created only by server workers.
      const role = ctx.role === 'CUSTOMER' ? 'CUSTOMER' : 'AGENT';

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: ctx.userId,
          content: parsed.data.content,
          role,
        },
        include: {
          sender: { select: { id: true, displayName: true, email: true, role: true } },
        },
      });

      // Update conversation timestamp
      await db.conversation.update({
        where: { id: conversationId },
        data: {
          status: conversation.status === 'OPEN' ? 'ASSIGNED' : conversation.status,
        },
      });

      return Response.json(message, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
