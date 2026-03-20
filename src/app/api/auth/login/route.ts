import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signMfaToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { audit } from '@/lib/audit';
import { loginSchema } from '@/lib/validations/auth';
import { errorResponse, AuthenticationError, TenantNotFoundError, ValidationError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { email, password, tenantSlug } = parsed.data;

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new TenantNotFoundError(tenantSlug);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('Account is not active');
    }

    // Verify password
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new AuthenticationError('Invalid email or password');
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined;

    // If MFA enabled, return MFA challenge
    if (user.mfaEnabled) {
      const mfaToken = await signMfaToken({
        userId: user.id,
        tenantId: tenant.id,
      });

      return Response.json({
        requiresMfa: true,
        mfaToken,
      });
    }

    // No MFA - issue full tokens
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const session = await createSession({ userId: user.id, userAgent, ipAddress });

    const accessToken = await signAccessToken({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit
    await audit({
      tenantId: tenant.id,
      userId: user.id,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    const response = Response.json({
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
    });

    response.headers.set(
      'Set-Cookie',
      `refreshToken=${session.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}`,
    );

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
