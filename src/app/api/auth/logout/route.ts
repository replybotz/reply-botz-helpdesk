import { prisma } from '@/lib/db';
import { createHash } from 'crypto';

function getRefreshTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(/refreshToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  const refreshToken = getRefreshTokenFromCookie(request);

  if (refreshToken) {
    const hashed = createHash('sha256').update(refreshToken).digest('hex');
    await prisma.session.deleteMany({ where: { refreshToken: hashed } }).catch(() => {});
  }

  const response = Response.json({ success: true });
  response.headers.set(
    'Set-Cookie',
    'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0',
  );
  return response;
}
