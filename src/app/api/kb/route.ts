import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { createArticleSchema } from '@/lib/validations/kb';
import { errorResponse, ValidationError } from '@/lib/errors';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export const GET = withPermission(Permission.KB_READ, async (req: Request, ctx: RouteContext) => {
  try {
    const db = prisma.$extends(withTenantScope(ctx.tenantId));
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const tag = url.searchParams.get('tag');
    const search = url.searchParams.get('search');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));

    const where: Record<string, unknown> = {};

    // Customers only see published articles
    if (ctx.role === 'CUSTOMER') {
      where.status = 'PUBLISHED';
    } else if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      db.knowledgeBaseArticle.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          tags: true,
          status: true,
          views: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.knowledgeBaseArticle.count({ where }),
    ]);

    return Response.json({ articles, total, page, limit });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withPermission(Permission.KB_CREATE, async (req: Request, ctx: RouteContext) => {
  try {
    const body = await req.json();
    const parsed = createArticleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const db = prisma.$extends(withTenantScope(ctx.tenantId));
    let slug = slugify(parsed.data.title);

    // Check slug uniqueness within tenant
    const existing = await db.knowledgeBaseArticle.findFirst({
      where: { slug },
    });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const article = await db.knowledgeBaseArticle.create({
      data: {
        tenantId: ctx.tenantId,
        title: parsed.data.title,
        slug,
        content: parsed.data.content,
        tags: parsed.data.tags,
        status: parsed.data.status,
      },
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'kb.article_created',
      entityType: 'knowledge_base_article',
      entityId: article.id,
    });

    return Response.json(article, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
