import { prisma } from '@/lib/db';
import { createHash } from 'crypto';
import { getCookie, clearAuthCookies } from '@/lib/auth/cookies';

export async function POST(request: Request) {
  const refreshToken = getCookie(request, 'refreshToken');

  if (refreshToken) {
    const hashed = createHash('sha256').update(refreshToken).digest('hex');
    try {
      await prisma.session.deleteMany({ where: { refreshToken: hashed } });
    } catch (error) {
      console.error('Failed to delete session on logout:', error);
    }
  }

  const response = Response.json({ success: true });
  for (const cookie of clearAuthCookies()) {
    response.headers.append('Set-Cookie', cookie);
  }
  return response;
}
