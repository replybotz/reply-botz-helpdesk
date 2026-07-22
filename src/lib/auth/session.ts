import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { generateRefreshToken } from './jwt';

const REFRESH_EXPIRY_DAYS = 7;

/**
 * A rotated-out token presented again within this window is treated as a
 * benign race (two tabs refreshing at once), not theft. Only reuse AFTER
 * the window revokes the user's sessions.
 */
const REUSE_GRACE_MS = 10 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(params: {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{ refreshToken: string; expiresAt: Date }> {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: params.userId,
      refreshToken: hashToken(refreshToken),
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt,
    },
  });

  return { refreshToken, expiresAt };
}

export async function validateSession(refreshToken: string): Promise<{
  sessionId: string;
  userId: string;
} | null> {
  const hashed = hashToken(refreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshToken: hashed },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });

  if (!session) return null;

  // A rotated-out token being presented again long after rotation means it
  // was stolen (or the client fell far out of sync); revoke everything for
  // this user. Within the grace window it's just concurrent tabs racing.
  if (session.revokedAt) {
    if (Date.now() - session.revokedAt.getTime() > REUSE_GRACE_MS) {
      await revokeAllUserSessions(session.userId);
    }
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return { sessionId: session.id, userId: session.userId };
}

export async function rotateSession(params: {
  oldRefreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{ refreshToken: string; expiresAt: Date; userId: string } | null> {
  const validated = await validateSession(params.oldRefreshToken);
  if (!validated) return null;

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Mark old and create new atomically; the old row is kept (until expiry
  // cleanup) so presenting it again can be detected as reuse. The guarded
  // updateMany serializes concurrent rotations of the same token: only the
  // request that flips revokedAt gets a new session, later ones get null.
  const rotated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.session.updateMany({
      where: { id: validated.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) return false;

    await tx.session.create({
      data: {
        userId: validated.userId,
        refreshToken: hashToken(refreshToken),
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        expiresAt,
      },
    });
    return true;
  });

  if (!rotated) return null;

  return { refreshToken, expiresAt, userId: validated.userId };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {
    // Session already deleted
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
