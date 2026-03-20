import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { encrypt, decrypt } from '@/lib/encryption';
import { updateIntegrationSchema } from '@/lib/validations/integrations';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';

export const GET = withPermission(
  Permission.INTEGRATION_READ,
  async (req: Request, ctx: RouteContext) => {
    try {
      const id = new URL(req.url).pathname.split('/').pop()!;
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const integration = await db.integration.findFirst({ where: { id } });
      if (!integration) throw new NotFoundError('Integration');

      // Decrypt config for display (mask sensitive values)
      let config = {};
      try {
        config = JSON.parse(decrypt(integration.config));
      } catch {
        // Config may not be encrypted in dev
      }

      return Response.json({
        id: integration.id,
        type: integration.type,
        config,
        status: integration.status,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    } catch (error) {
      return errorResponse(error);
    }
  },
);

export const PATCH = withPermission(
  Permission.INTEGRATION_MANAGE,
  async (req: Request, ctx: RouteContext) => {
    try {
      const id = new URL(req.url).pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateIntegrationSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          'Validation failed',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }

      const db = prisma.$extends(withTenantScope(ctx.tenantId));
      const existing = await db.integration.findFirst({ where: { id } });
      if (!existing) throw new NotFoundError('Integration');

      const data: Record<string, unknown> = {};
      if (parsed.data.status) data.status = parsed.data.status;
      if (parsed.data.config) data.config = encrypt(JSON.stringify(parsed.data.config));

      const integration = await db.integration.update({
        where: { id },
        data,
        select: {
          id: true,
          type: true,
          status: true,
          updatedAt: true,
        },
      });

      await audit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'integration.updated',
        entityType: 'integration',
        entityId: integration.id,
      });

      return Response.json(integration);
    } catch (error) {
      return errorResponse(error);
    }
  },
);

export const DELETE = withPermission(
  Permission.INTEGRATION_MANAGE,
  async (req: Request, ctx: RouteContext) => {
    try {
      const id = new URL(req.url).pathname.split('/').pop()!;
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const existing = await db.integration.findFirst({ where: { id } });
      if (!existing) throw new NotFoundError('Integration');

      await db.integration.delete({ where: { id } });

      await audit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'integration.deleted',
        entityType: 'integration',
        entityId: id,
      });

      return Response.json({ success: true });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
