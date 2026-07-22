import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { generateMfaSecret, pendingMfaSecretKey } from '@/lib/auth/mfa';
import { encrypt } from '@/lib/encryption';
import { errorResponse, AuthenticationError } from '@/lib/errors';

const SETUP_TTL_SEC = 10 * 60;

export async function POST() {
  try {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    const tenantId = headerStore.get('x-tenant-id');

    // Only a fully-authenticated user may (re)configure MFA. An MFA-pending
    // session knows only the password and must never reach setup.
    if (!userId || !tenantId || headerStore.get('x-mfa-pending')) {
      throw new AuthenticationError();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new AuthenticationError();
    }

    const { secret, uri } = generateMfaSecret(user.email);

    // The secret the verify step trusts is this server-side copy, never one
    // supplied by the client.
    await redis.set(pendingMfaSecretKey(tenantId, userId), encrypt(secret), 'EX', SETUP_TTL_SEC);

    return Response.json({ secret, uri });
  } catch (error) {
    return errorResponse(error);
  }
}
