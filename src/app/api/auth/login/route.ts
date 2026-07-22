import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signMfaToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { setAuthCookies, accessTokenCookie } from '@/lib/auth/cookies';
import { enforceRateLimit, clientIp } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';
import { loginSchema } from '@/lib/validations/auth';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/errors';

// Verified in place of a real hash when the tenant or user does not exist,
// so response timing cannot distinguish "unknown account" from "bad password".
const dummyHashPromise = hashPassword('timing-equalizer-dummy-password');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { email, password, tenantSlug } = parsed.data;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined;

    await enforceRateLimit(`login:ip:${clientIp(request)}`, { max: 20, windowSec: 300 });
    await enforceRateLimit(`login:id:${tenantSlug}:${email.toLowerCase()}`, { max: 5, windowSec: 300 });

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true },
    });

    const user =
      tenant && tenant.status === 'ACTIVE'
        ? await prisma.user.findUnique({
            where: { tenantId_email: { tenantId: tenant.id, email } },
          })
        : null;

    // Always verify against some hash, and always return the same error for
    // unknown tenant, unknown user, inactive account, and wrong password.
    const valid = await verifyPassword(user?.passwordHash ?? (await dummyHashPromise), password);
    if (!user || !valid || user.status !== 'ACTIVE') {
      throw new AuthenticationError('Invalid email or password');
    }

    // If MFA enabled, set a short-lived MFA-pending cookie and challenge
    if (user.mfaEnabled) {
      const mfaToken = await signMfaToken({
        userId: user.id,
        tenantId: user.tenantId,
      });

      const response = Response.json({ requiresMfa: true });
      response.headers.append('Set-Cookie', accessTokenCookie(mfaToken, 5 * 60));
      return response;
    }

    // No MFA - issue full tokens
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const session = await createSession({ userId: user.id, userAgent, ipAddress });

    const accessToken = await signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
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
      tenantId: user.tenantId,
      userId: user.id,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    const response = Response.json({
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      },
      expiresAt: session.expiresAt,
    });

    return setAuthCookies(response, { accessToken, refreshToken: session.refreshToken });
  } catch (error) {
    return errorResponse(error);
  }
}
