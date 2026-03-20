import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { rotateSession } from '@/lib/auth/session';
import { errorResponse, AuthenticationError } from '@/lib/errors';

function getRefreshTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  const match = cookie.match(/refreshToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  try {
    const refreshToken = getRefreshTokenFromCookie(request);
    if (!refreshToken) {
      throw new AuthenticationError('No refresh token provided');
    }

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined;

    const result = await rotateSession({
      oldRefreshToken: refreshToken,
      userAgent,
      ipAddress,
    });

    if (!result) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // Fetch user for token payload
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, tenantId: true, role: true, email: true },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const accessToken = await signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    const response = Response.json({
      tokens: {
        accessToken,
        expiresAt: result.expiresAt,
      },
    });

    response.headers.set(
      'Set-Cookie',
      `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}`,
    );

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
