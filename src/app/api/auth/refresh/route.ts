import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth/jwt';
import { rotateSession } from '@/lib/auth/session';
import { setAuthCookies, getCookie } from '@/lib/auth/cookies';
import { errorResponse, AuthenticationError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const refreshToken = getCookie(request, 'refreshToken');
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
      select: { id: true, tenantId: true, role: true, email: true, mustChangePassword: true },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const accessToken = await signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    });

    const response = Response.json({ expiresAt: result.expiresAt });

    return setAuthCookies(response, { accessToken, refreshToken: result.refreshToken });
  } catch (error) {
    return errorResponse(error);
  }
}
