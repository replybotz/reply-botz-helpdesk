import { headers } from 'next/headers';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { listUserSessions } from '@/lib/auth/session';
import { getCookie } from '@/lib/auth/cookies';
import { errorResponse, AuthenticationError } from '@/lib/errors';

/** Active sessions for the signed-in user, flagging the one making the request. */
export async function GET(request: Request) {
  try {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    if (!userId) throw new AuthenticationError();

    const sessions = await listUserSessions(userId);

    // Identify the caller's own session by hashing its refresh token the same
    // way it is stored — the raw token is never compared or returned.
    const refreshToken = getCookie(request, 'refreshToken');
    const currentHash = refreshToken
      ? createHash('sha256').update(refreshToken).digest('hex')
      : null;
    const current = currentHash
      ? await prisma.session.findUnique({
          where: { refreshToken: currentHash },
          select: { id: true },
        })
      : null;

    return Response.json({
      sessions: sessions.map((session) => ({
        ...session,
        isCurrent: session.id === current?.id,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
