import { prisma } from '@/lib/db';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { updateTenantSchema } from '@/lib/validations/tenants';
import { errorResponse, ValidationError } from '@/lib/errors';

// GET current tenant info (for TENANT_ADMIN+)
export const GET = withPermission(Permission.TENANT_READ, async (_req: Request, ctx: RouteContext) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        plan: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json(tenant);
  } catch (error) {
    return errorResponse(error);
  }
});

// PATCH - update current tenant
export const PATCH = withPermission(Permission.TENANT_UPDATE, async (req: Request, ctx: RouteContext) => {
  try {
    const body = await req.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const data = {
      ...parsed.data,
      settings: parsed.data.settings ? JSON.parse(JSON.stringify(parsed.data.settings)) : undefined,
    };

    const tenant = await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        plan: true,
        status: true,
        settings: true,
        updatedAt: true,
      },
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'tenant.updated',
      entityType: 'tenant',
      entityId: tenant.id,
      changes: JSON.parse(JSON.stringify(parsed.data)),
    });

    return Response.json(tenant);
  } catch (error) {
    return errorResponse(error);
  }
});
