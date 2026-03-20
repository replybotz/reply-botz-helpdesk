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

export function withPermission(
  permission: PermissionKey,
  handler: (req: Request, context: RouteContext) => Promise<Response>,
) {
  return async (req: Request) => {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    const userRole = headerStore.get('x-user-role');
    const tenantId = headerStore.get('x-tenant-id');

    if (!userId || !userRole || !tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(userRole as UserRole, permission)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(req, {
      tenantId,
      userId,
      role: userRole as UserRole,
    });
  };
}
