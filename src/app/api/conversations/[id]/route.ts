import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { updateConversationSchema } from '@/lib/validations/conversations';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';

export const GET = withPermission(
  Permission.CONVERSATION_READ,
  async (req: Request, ctx: RouteContext) => {
    try {
      const id = new URL(req.url).pathname.split('/').pop()!;
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const conversation = await db.conversation.findFirst({
        where: { id },
        include: {
          customer: { select: { id: true, displayName: true, email: true } },
          messages: {
            include: {
              sender: { select: { id: true, displayName: true, email: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          ticket: {
            select: { id: true, subject: true, status: true, priority: true },
          },
        },
      });

      if (!conversation) throw new NotFoundError('Conversation');
      return Response.json(conversation);
    } catch (error) {
      return errorResponse(error);
    }
  },
);

export const PATCH = withPermission(
  Permission.CONVERSATION_CLOSE,
  async (req: Request, ctx: RouteContext) => {
    try {
      const id = new URL(req.url).pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateConversationSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          'Validation failed',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }

      const db = prisma.$extends(withTenantScope(ctx.tenantId));
      const existing = await db.conversation.findFirst({ where: { id } });
      if (!existing) throw new NotFoundError('Conversation');

      const conversation = await db.conversation.update({
        where: { id },
        data: parsed.data,
        include: {
          customer: { select: { id: true, displayName: true, email: true } },
        },
      });

      await audit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'conversation.updated',
        entityType: 'conversation',
        entityId: conversation.id,
        changes: JSON.parse(JSON.stringify(parsed.data)),
      });

      return Response.json(conversation);
    } catch (error) {
      return errorResponse(error);
    }
  },
);
