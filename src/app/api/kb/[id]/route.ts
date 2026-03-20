import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { updateArticleSchema } from '@/lib/validations/kb';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';

export const GET = withPermission(Permission.KB_READ, async (req: Request, ctx: RouteContext) => {
  try {
    const id = new URL(req.url).pathname.split('/').pop()!;
    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    const article = await db.knowledgeBaseArticle.findFirst({
      where: { id },
    });

    if (!article) throw new NotFoundError('Article');

    // Increment views
    await db.knowledgeBaseArticle.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return Response.json(article);
  } catch (error) {
    return errorResponse(error);
  }
});

export const PATCH = withPermission(Permission.KB_UPDATE, async (req: Request, ctx: RouteContext) => {
  try {
    const id = new URL(req.url).pathname.split('/').pop()!;
    const body = await req.json();
    const parsed = updateArticleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const db = prisma.$extends(withTenantScope(ctx.tenantId));
    const existing = await db.knowledgeBaseArticle.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError('Article');

    const article = await db.knowledgeBaseArticle.update({
      where: { id },
      data: parsed.data,
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'kb.article_updated',
      entityType: 'knowledge_base_article',
      entityId: article.id,
      changes: JSON.parse(JSON.stringify(parsed.data)),
    });

    return Response.json(article);
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = withPermission(Permission.KB_DELETE, async (req: Request, ctx: RouteContext) => {
  try {
    const id = new URL(req.url).pathname.split('/').pop()!;
    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    const existing = await db.knowledgeBaseArticle.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError('Article');

    await db.knowledgeBaseArticle.delete({ where: { id } });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'kb.article_deleted',
      entityType: 'knowledge_base_article',
      entityId: id,
    });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
});
