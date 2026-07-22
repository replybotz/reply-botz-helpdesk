import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext, type RouteHandlerContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { updateUserSchema } from '@/lib/validations/users';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';

export const GET = withPermission(Permission.USER_READ, async (req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
  try {
    const { id } = await routeCtx.params;
    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    const user = await db.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundError('User');
    return Response.json(user);
  } catch (error) {
    return errorResponse(error);
  }
});

export const PATCH = withPermission(Permission.USER_UPDATE, async (req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
  try {
    const { id } = await routeCtx.params;
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const db = prisma.$extends(withTenantScope(ctx.tenantId));
    const existing = await db.user.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError('User');

    const user = await db.user.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'user.updated',
      entityType: 'user',
      entityId: user.id,
      changes: JSON.parse(JSON.stringify(parsed.data)),
    });

    return Response.json(user);
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = withPermission(Permission.USER_DELETE, async (req: Request, ctx: RouteContext, routeCtx: RouteHandlerContext) => {
  try {
    const { id } = await routeCtx.params;
    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    const existing = await db.user.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError('User');

    await db.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'user.deactivated',
      entityType: 'user',
      entityId: id,
    });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
});
