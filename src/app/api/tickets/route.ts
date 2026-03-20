import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { createTicketSchema } from '@/lib/validations/tickets';
import { errorResponse, ValidationError } from '@/lib/errors';

export const GET = withPermission(Permission.TICKET_READ, async (req: Request, ctx: RouteContext) => {
  try {
    const db = prisma.$extends(withTenantScope(ctx.tenantId));
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const assignedTo = url.searchParams.get('assignedTo');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;

    // Customers can only see their own tickets via conversations
    if (ctx.role === 'CUSTOMER') {
      where.conversation = { customerId: ctx.userId };
    }

    const [tickets, total] = await Promise.all([
      db.ticket.findMany({
        where,
        include: {
          assignee: { select: { id: true, displayName: true, email: true } },
          conversation: { select: { id: true, channel: true, customerId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ticket.count({ where }),
    ]);

    return Response.json({ tickets, total, page, limit });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withPermission(Permission.TICKET_CREATE, async (req: Request, ctx: RouteContext) => {
  try {
    const body = await req.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const db = prisma.$extends(withTenantScope(ctx.tenantId));
    const ticket = await db.ticket.create({
      data: {
        tenantId: ctx.tenantId,
        subject: parsed.data.subject,
        description: parsed.data.description,
        priority: parsed.data.priority,
        conversationId: parsed.data.conversationId,
      },
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
      },
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ticket.created',
      entityType: 'ticket',
      entityId: ticket.id,
    });

    return Response.json(ticket, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
