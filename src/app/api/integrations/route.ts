import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { encrypt } from '@/lib/encryption';
import { createIntegrationSchema } from '@/lib/validations/integrations';
import { errorResponse, ValidationError } from '@/lib/errors';

export const GET = withPermission(
  Permission.INTEGRATION_READ,
  async (_req: Request, ctx: RouteContext) => {
    try {
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const integrations = await db.integration.findMany({
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ integrations });
    } catch (error) {
      return errorResponse(error);
    }
  },
);

export const POST = withPermission(
  Permission.INTEGRATION_MANAGE,
  async (req: Request, ctx: RouteContext) => {
    try {
      const body = await req.json();
      const parsed = createIntegrationSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          'Validation failed',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }

      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const integration = await db.integration.create({
        data: {
          tenantId: ctx.tenantId,
          type: parsed.data.type,
          config: encrypt(JSON.stringify(parsed.data.config)),
          status: 'ACTIVE',
        },
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
        },
      });

      await audit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'integration.created',
        entityType: 'integration',
        entityId: integration.id,
      });

      return Response.json(integration, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
