import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_ROUTES = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/health'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function resolveTenantSlug(request: NextRequest): string | null {
  const host = request.headers.get('host') ?? '';
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'replybotz.localhost';

  if (host !== appDomain && host.endsWith(`.${appDomain}`)) {
    const subdomain = host.replace(`.${appDomain}`, '');
    if (subdomain && !subdomain.includes('.')) {
      return subdomain;
    }
  }

  const headerSlug = request.headers.get('x-tenant-slug');
  if (headerSlug) return headerSlug;

  const querySlug = request.nextUrl.searchParams.get('tenant');
  if (querySlug) return querySlug;

  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const tenantSlug = resolveTenantSlug(request);
  const requestHeaders = new Headers(request.headers);

  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }

  // Public routes skip auth
  if (isPublicRoute(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Check for access token
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!accessToken) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');
    const { payload } = await jwtVerify(accessToken, secret);

    // Reject MFA-pending tokens on non-MFA routes
    if ((payload as Record<string, unknown>).mfaPending && !pathname.startsWith('/mfa') && !pathname.startsWith('/api/auth/mfa')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'MFA verification required' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/mfa', request.url));
    }

    requestHeaders.set('x-user-id', payload.sub as string);
    requestHeaders.set('x-user-role', (payload as Record<string, unknown>).role as string);
    requestHeaders.set('x-tenant-id', (payload as Record<string, unknown>).tenantId as string);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
