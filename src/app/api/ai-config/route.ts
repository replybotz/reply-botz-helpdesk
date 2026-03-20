import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { encrypt } from '@/lib/encryption';
import { errorResponse, ValidationError } from '@/lib/errors';
import { z } from 'zod';

const createAiConfigSchema = z.object({
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  apiKey: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
});

export const GET = withPermission(
  Permission.AI_CONFIG_READ,
  async (_req: Request, ctx: RouteContext) => {
    try {
      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const configs = await db.aiConfiguration.findMany({
        select: {
          id: true,
          provider: true,
          model: true,
          settings: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ configs });
    } catch (error) {
      return errorResponse(error);
    }
  },
);

export const POST = withPermission(
  Permission.AI_CONFIG_MANAGE,
  async (req: Request, ctx: RouteContext) => {
    try {
      const body = await req.json();
      const parsed = createAiConfigSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          'Validation failed',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }

      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const config = await db.aiConfiguration.create({
        data: {
          tenantId: ctx.tenantId,
          provider: parsed.data.provider,
          model: parsed.data.model,
          apiKey: encrypt(parsed.data.apiKey),
          settings: parsed.data.settings,
        },
        select: {
          id: true,
          provider: true,
          model: true,
          isActive: true,
          createdAt: true,
        },
      });

      await audit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'ai_config.created',
        entityType: 'ai_configuration',
        entityId: config.id,
      });

      return Response.json(config, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
