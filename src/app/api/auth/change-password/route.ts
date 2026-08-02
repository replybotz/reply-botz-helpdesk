import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signAccessToken } from '@/lib/auth/jwt';
import { createSession, revokeAllUserSessions } from '@/lib/auth/session';
import { setAuthCookies, getCookie } from '@/lib/auth/cookies';
import { audit } from '@/lib/audit';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/errors';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    if (!userId) throw new AuthenticationError();

    const parsed = changePasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthenticationError();

    if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
      throw new AuthenticationError('Current password is incorrect');
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      throw new ValidationError('Validation failed', {
        newPassword: ['New password must differ from the current one'],
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        mustChangePassword: false,
      },
    });

    // A password change invalidates every existing session — including any an
    // attacker may hold. The caller is then re-issued a fresh one so they
    // aren't logged out of the tab they just used.
    await revokeAllUserSessions(user.id);

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined;
    const session = await createSession({ userId: user.id, userAgent, ipAddress });

    const accessToken = await signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      mustChangePassword: false,
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'user.password_changed',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    const response = Response.json({ success: true });
    return setAuthCookies(response, { accessToken, refreshToken: session.refreshToken });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Whether the signed-in user is currently forced to change their password. */
export async function GET(request: Request) {
  try {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    if (!userId || !getCookie(request, 'accessToken')) throw new AuthenticationError();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mustChangePassword: true },
    });
    if (!user) throw new AuthenticationError();

    return Response.json({ mustChangePassword: user.mustChangePassword });
  } catch (error) {
    return errorResponse(error);
  }
}
