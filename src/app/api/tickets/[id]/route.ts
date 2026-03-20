import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { updateTicketSchema } from '@/lib/validations/tickets';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';

export const GET = withPermission(Permission.TICKET_READ, async (req: Request, ctx: RouteContext) => {
  try {
    const id = new URL(req.url).pathname.split('/').pop()!;
    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    const ticket = await db.ticket.findFirst({
      where: { id },
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        conversation: {
          select: {
            id: true,
            channel: true,
            status: true,
            customer: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundError('Ticket');
    return Response.json(ticket);
  } catch (error) {
    return errorResponse(error);
  }
});

export const PATCH = withPermission(Permission.TICKET_UPDATE, async (req: Request, ctx: RouteContext) => {
  try {
    const id = new URL(req.url).pathname.split('/').pop()!;
    const body = await req.json();
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    const existing = await db.ticket.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError('Ticket');

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === 'RESOLVED' && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    }

    const ticket = await db.ticket.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
      },
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ticket.updated',
      entityType: 'ticket',
      entityId: ticket.id,
      changes: JSON.parse(JSON.stringify(parsed.data)),
    });

    return Response.json(ticket);
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = withPermission(Permission.TICKET_DELETE, async (req: Request, ctx: RouteContext) => {
  try {
    const id = new URL(req.url).pathname.split('/').pop()!;
    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    const existing = await db.ticket.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError('Ticket');

    await db.ticket.delete({ where: { id } });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ticket.deleted',
      entityType: 'ticket',
      entityId: id,
    });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
});
