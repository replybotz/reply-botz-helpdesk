import { prisma } from '@/lib/db';
import { verifyMfaToken as verifyTotp } from '@/lib/auth/mfa';
import { verifyMfaToken as verifyMfaJwt, signAccessToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { encrypt } from '@/lib/encryption';
import { audit } from '@/lib/audit';
import { mfaVerifySchema, mfaSetupVerifySchema } from '@/lib/validations/auth';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/errors';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');

    // Case 1: MFA Setup verification (authenticated user enabling MFA)
    if (userId) {
      const parsed = mfaSetupVerifySchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
      }

      const { token, secret } = parsed.data;
      const valid = verifyTotp(secret, token);
      if (!valid) {
        throw new AuthenticationError('Invalid MFA code');
      }

      // Store encrypted secret and enable MFA
      await prisma.user.update({
        where: { id: userId },
        data: {
          mfaSecret: encrypt(secret),
          mfaEnabled: true,
        },
      });

      const tenantId = headerStore.get('x-tenant-id');
      if (tenantId) {
        await audit({
          tenantId,
          userId,
          action: 'user.mfa_enabled',
          entityType: 'user',
          entityId: userId,
        });
      }

      return Response.json({ success: true, mfaEnabled: true });
    }

    // Case 2: MFA Login verification (unauthenticated user with MFA token)
    const parsed = mfaVerifySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { token, mfaToken } = parsed.data;
    if (!mfaToken) {
      throw new AuthenticationError('MFA token is required');
    }

    // Verify MFA JWT
    const mfaPayload = await verifyMfaJwt(mfaToken);

    // Get user and verify TOTP
    const user = await prisma.user.findUnique({
      where: { id: mfaPayload.sub },
    });

    if (!user || !user.mfaSecret) {
      throw new AuthenticationError('Invalid MFA configuration');
    }

    // Decrypt the stored secret
    const { decrypt } = await import('@/lib/encryption');
    const decryptedSecret = decrypt(user.mfaSecret);
    const valid = verifyTotp(decryptedSecret, token);

    if (!valid) {
      throw new AuthenticationError('Invalid MFA code');
    }

    // Issue full auth tokens
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined;
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
