import { UserRole } from '@/generated/prisma';
import { ROLE_PERMISSIONS } from './roles';
import type { PermissionKey } from './permissions';
import { headers } from 'next/headers';

export function hasPermission(role: UserRole, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: PermissionKey[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export interface RouteContext {
  tenantId: string;
  userId: string;
  role: UserRole;
}

/** Next 16 route-handler context: `params` resolves to the dynamic segments. */
export interface RouteHandlerContext<P = Record<string, string>> {
  params: Promise<P>;
}

/**
 * Wrap a route handler with an RBAC check. Passing an array grants access
 * when ANY of the permissions match (e.g. TICKET_READ for staff alongside
 * TICKET_READ_OWN for customers — the handler must then scope customer
 * queries itself).
 */
export function withPermission<P = Record<string, string>>(
  permission: PermissionKey | PermissionKey[],
  handler: (req: Request, context: RouteContext, routeCtx: RouteHandlerContext<P>) => Promise<Response>,
) {
  return async (req: Request, routeCtx: RouteHandlerContext<P>) => {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    const userRole = headerStore.get('x-user-role');
    const tenantId = headerStore.get('x-tenant-id');

    if (!userId || !userRole || !tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const required = Array.isArray(permission) ? permission : [permission];
    if (!hasAnyPermission(userRole as UserRole, required)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(
      req,
      {
        tenantId,
        userId,
        role: userRole as UserRole,
      },
      routeCtx,
    );
  };
}
