import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { signAccessToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { audit } from '@/lib/audit';
import { registerSchema } from '@/lib/validations/auth';
import { errorResponse, ConflictError, TenantNotFoundError, ValidationError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { email, password, displayName, tenantSlug } = parsed.data;

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new TenantNotFoundError(tenantSlug);
    }

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });

    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        displayName,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    // Create session
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined;
    const session = await createSession({ userId: user.id, userAgent, ipAddress });

    // Generate access token
    const accessToken = await signAccessToken({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    });

    // Audit
    await audit({
      tenantId: tenant.id,
      userId: user.id,
      action: 'user.registered',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    const response = Response.json(
      {
        user: {
          id: user.id,
          tenantId: tenant.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
        },
        tokens: {
          accessToken,
          expiresAt: session.expiresAt,
        },
      },
      { status: 201 },
    );

    // Set refresh token cookie
    response.headers.set(
      'Set-Cookie',
      `refreshToken=${session.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}`,
    );

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
