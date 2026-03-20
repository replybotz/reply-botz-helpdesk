import { prisma } from '@/lib/db';
import { withTenantScope } from '@/lib/tenant/rls';
import { withPermission, type RouteContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { audit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth/password';
import { createUserSchema } from '@/lib/validations/users';
import { errorResponse, ValidationError, ConflictError } from '@/lib/errors';

export const GET = withPermission(Permission.USER_READ, async (req: Request, ctx: RouteContext) => {
  try {
    const db = prisma.$extends(withTenantScope(ctx.tenantId));
    const url = new URL(req.url);
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return Response.json({ users, total, page, limit });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withPermission(Permission.USER_CREATE, async (req: Request, ctx: RouteContext) => {
  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const db = prisma.$extends(withTenantScope(ctx.tenantId));

    // Check email uniqueness within tenant
    const existing = await db.user.findFirst({
      where: { email: parsed.data.email },
    });
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await db.user.create({
      data: {
        tenantId: ctx.tenantId,
        email: parsed.data.email,
        passwordHash,
        displayName: parsed.data.displayName,
        role: parsed.data.role,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await audit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
    });

    return Response.json(user, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
