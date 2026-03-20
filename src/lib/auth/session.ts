import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { generateRefreshToken } from './jwt';

const REFRESH_EXPIRY_DAYS = 7;

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
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
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

  // Delete old session
  await prisma.session.delete({ where: { id: validated.sessionId } });

  // Create new session
  const newSession = await createSession({
    userId: validated.userId,
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
  });

  return { ...newSession, userId: validated.userId };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {
    // Session already deleted
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
