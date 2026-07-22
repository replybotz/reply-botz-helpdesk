import { NextRequest } from 'next/server';

export function resolveTenantSlug(request: NextRequest): string | null {
  // 1. Try subdomain
  const host = request.headers.get('host') ?? '';
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'replybotz.localhost';

  if (host !== appDomain && host.endsWith(`.${appDomain}`)) {
    const subdomain = host.replace(`.${appDomain}`, '');
    if (subdomain && !subdomain.includes('.')) {
      return subdomain;
    }
  }

  // 2. Try X-Tenant-Slug header
  const headerSlug = request.headers.get('x-tenant-slug');
  if (headerSlug) return headerSlug;

  // 3. Try query parameter (development fallback)
  const querySlug = request.nextUrl.searchParams.get('tenant');
  if (querySlug) return querySlug;

  return null;
}
