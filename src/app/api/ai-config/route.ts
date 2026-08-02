import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { encrypt } from '@/lib/encryption';
import { errorResponse, ValidationError } from '@/lib/errors';
import { PROVIDERS, PROVIDER_IDS, isProviderId } from '@/lib/ai/providers';
import { z } from 'zod';

const createAiConfigSchema = z.object({
  provider: z.enum(PROVIDER_IDS as [string, ...string[]]),
  // Optional: falls back to the provider's default model.
  model: z.string().max(100).optional(),
  // Optional: providers such as Ollama need no credential.
  apiKey: z.string().optional(),
  settings: z
    .object({ baseUrl: z.string().url().optional() })
    .partial()
    .optional(),
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

      const { provider, settings } = parsed.data;
      if (!isProviderId(provider)) {
        throw new ValidationError('Validation failed', { provider: ['Unsupported provider'] });
      }
      const definition = PROVIDERS[provider];

      if (definition.requiresApiKey && !parsed.data.apiKey) {
        throw new ValidationError('Validation failed', {
          apiKey: [`${definition.label} requires an API key`],
        });
      }
      if (definition.requiresBaseUrl && !settings?.baseUrl) {
        throw new ValidationError('Validation failed', {
          baseUrl: [`${definition.label} requires a base URL`],
        });
      }

      const model = parsed.data.model?.trim() || definition.defaultModel;
      if (!model) {
        throw new ValidationError('Validation failed', {
          model: [`${definition.label} requires a model name`],
        });
      }

      const db = prisma.$extends(withTenantScope(ctx.tenantId));

      const config = await db.aiConfiguration.create({
        data: {
          tenantId: ctx.tenantId,
          provider,
          model,
          // Keyless providers store an empty (still encrypted) credential.
          apiKey: parsed.data.apiKey ? encrypt(parsed.data.apiKey) : '',
          settings: settings ?? {},
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
