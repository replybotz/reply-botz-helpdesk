import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { createConversationSchema } from '@/lib/validations/conversations';
import { errorResponse, ValidationError } from '@/lib/errors';

export const GET = withPermission(
  Permission.CONVERSATION_READ,
  async (req: Request, ctx: RouteContext) => {
    try {
      const db = prisma.$extends(withTenantScope(ctx.tenantId));
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const channel = url.searchParams.get('channel');
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (channel) where.channel = channel;
      if (ctx.role === 'CUSTOMER') where.customerId = ctx.userId;

      const [conversations, total] = await Promise.all([
        db.conversation.findMany({
          where,
          include: {
            customer: { select: { id: true, displayName: true, email: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { content: true, role: true, createdAt: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.conversation.count({ where }),
      ]);

      return Response.json({ conversations, total, page, limit });
    } catch (error) {
      return errorResponse(error);
    }
  },
);

export const POST = withPermission(
  Permission.CONVERSATION_CREATE,
  async (req: Request, ctx: RouteContext) => {
    try {
      const body = await req.json();
      const parsed = createConversationSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          'Validation failed',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }

      const db = prisma.$extends(withTenantScope(ctx.tenantId));
      const customerId = parsed.data.customerId ?? ctx.userId;

      const conversation = await db.conversation.create({
        data: {
          tenantId: ctx.tenantId,
          channel: parsed.data.channel,
          customerId,
          metadata: (parsed.data.metadata ?? {}) as Record<string, string>,
        },
        include: {
          customer: { select: { id: true, displayName: true, email: true } },
        },
      });

      await audit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'conversation.created',
        entityType: 'conversation',
        entityId: conversation.id,
      });

      return Response.json(conversation, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
