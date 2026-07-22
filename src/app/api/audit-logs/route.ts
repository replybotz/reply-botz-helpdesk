import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { errorResponse } from '@/lib/errors';

export const GET = withPermission(
  Permission.AUDIT_LOG_READ,
  async (req: Request, ctx: RouteContext) => {
    try {
      const db = prisma.$extends(withTenantScope(ctx.tenantId));
      const url = new URL(req.url);
      const entityType = url.searchParams.get('entityType');
      const userId = url.searchParams.get('userId');
      const action = url.searchParams.get('action');
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));

      const where: Record<string, unknown> = {};
      if (entityType) where.entityType = entityType;
      if (userId) where.userId = userId;
      if (action) where.action = { contains: action };

      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          include: {
            user: { select: { id: true, displayName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.auditLog.count({ where }),
      ]);

      return Response.json({ logs, total, page, limit });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
