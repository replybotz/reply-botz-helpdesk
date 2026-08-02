import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { verifyMfaToken as verifyTotp, pendingMfaSecretKey } from '@/lib/auth/mfa';
import { signAccessToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { setAuthCookies } from '@/lib/auth/cookies';
import { assertMfaNotLocked, recordMfaFailure, clearMfaFailures } from '@/lib/rate-limit';
import { encrypt, decrypt } from '@/lib/encryption';
import { audit } from '@/lib/audit';
import { mfaVerifySchema } from '@/lib/validations/auth';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const headerStore = await headers();
    // Both headers are stamped by the proxy from the *verified* JWT and are
    // stripped from incoming requests, so they cannot be spoofed.
    const userId = headerStore.get('x-user-id');
    const tenantId = headerStore.get('x-tenant-id');
    const mfaPending = headerStore.get('x-mfa-pending') === '1';

    if (!userId || !tenantId) {
      throw new AuthenticationError();
    }

    const parsed = mfaVerifySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const { token } = parsed.data;

    await assertMfaNotLocked(userId);

    // Case 1: setup verification — a fully-authenticated user enabling MFA.
    // The mfaPending check is what prevents a password-only attacker from
    // overwriting the account's MFA secret.
    if (!mfaPending) {
      const encryptedPending = await redis.get(pendingMfaSecretKey(tenantId, userId));
      if (!encryptedPending) {
        throw new AuthenticationError('No MFA setup in progress. Request a new setup code.');
      }

      const secret = decrypt(encryptedPending);
      if (!verifyTotp(secret, token)) {
        await recordMfaFailure(userId);
        throw new AuthenticationError('Invalid MFA code');
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          mfaSecret: encrypt(secret),
          mfaEnabled: true,
        },
      });
      await redis.del(pendingMfaSecretKey(tenantId, userId));
      await clearMfaFailures(userId);

      await audit({
        tenantId,
        userId,
        action: 'user.mfa_enabled',
        entityType: 'user',
        entityId: userId,
      });

      return Response.json({ success: true, mfaEnabled: true });
    }

    // Case 2: login verification — an MFA-pending session completing sign-in.
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.mfaSecret) {
      throw new AuthenticationError('Invalid MFA configuration');
    }

    const decryptedSecret = decrypt(user.mfaSecret);
    if (!verifyTotp(decryptedSecret, token)) {
      await recordMfaFailure(userId);
      throw new AuthenticationError('Invalid MFA code');
    }
    await clearMfaFailures(userId);

    // Issue full auth tokens
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined;
    const session = await createSession({ userId: user.id, userAgent, ipAddress });

    const accessToken = await signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'user.login_mfa',
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
