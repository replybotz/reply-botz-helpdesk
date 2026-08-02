import { headers } from 'next/headers';
import { revokeUserSession } from '@/lib/auth/session';
import { audit } from '@/lib/audit';
import { errorResponse, AuthenticationError, NotFoundError } from '@/lib/errors';

/** Revoke one of the signed-in user's own sessions (sign out that device). */
export async function DELETE(
  _request: Request,
  routeCtx: { params: Promise<{ id: string }> },
) {
  try {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    const tenantId = headerStore.get('x-tenant-id');
    if (!userId || !tenantId) throw new AuthenticationError();

    const { id } = await routeCtx.params;

    // Scoped to the caller's own sessions, so one user cannot revoke another's.
    const revoked = await revokeUserSession(userId, id);
    if (!revoked) throw new NotFoundError('Session');

    await audit({
      tenantId,
      userId,
      action: 'user.session_revoked',
      entityType: 'session',
      entityId: id,
    });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
