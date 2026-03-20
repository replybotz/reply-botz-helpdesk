import { headers } from 'next/headers';
import { cache } from 'react';

export interface TenantContext {
  tenantId: string;
  tenantSlug: string | null;
  userId: string | null;
  userRole: string | null;
}

export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');
  const tenantSlug = headerStore.get('x-tenant-slug');
  const userId = headerStore.get('x-user-id');
  const userRole = headerStore.get('x-user-role');

  if (!tenantId) {
    throw new Error('Tenant context not available');
  }

  return { tenantId, tenantSlug, userId, userRole };
});

export function getTenantFromHeaders(headerStore: Headers): {
  tenantId: string | null;
  tenantSlug: string | null;
  userId: string | null;
  userRole: string | null;
} {
  return {
    tenantId: headerStore.get('x-tenant-id'),
    tenantSlug: headerStore.get('x-tenant-slug'),
    userId: headerStore.get('x-user-id'),
    userRole: headerStore.get('x-user-role'),
  };
}
