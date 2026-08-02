import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { resolveTenantSlug } from '@/lib/tenant/middleware';

// Logout is public: it authenticates itself via the refresh-token cookie and
// must work for expired-access and MFA-pending sessions alike.
const PUBLIC_ROUTES = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout', '/api/health'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * CSRF defense-in-depth: cookie-authenticated browsers always send an Origin
 * header on cross-site requests, so a mutating /api request whose Origin
 * disagrees with Host is rejected. Bearer-header API clients send no Origin
 * and are unaffected.
 */
function isCrossOrigin(request: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get('host');
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/') && isCrossOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  const tenantSlug = resolveTenantSlug(request);
  const requestHeaders = new Headers(request.headers);

  // Identity headers must only ever come from the verified token below.
  requestHeaders.delete('x-user-id');
  requestHeaders.delete('x-user-role');
  requestHeaders.delete('x-tenant-id');
  requestHeaders.delete('x-mfa-pending');

  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }

  // Public routes skip auth
  if (isPublicRoute(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Browser clients carry the token in an httpOnly cookie; API clients may
  // use an Authorization header instead.
  const authHeader = request.headers.get('authorization');
  const accessToken =
    request.cookies.get('accessToken')?.value ??
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!accessToken) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Fail closed: never fall back to a guessable empty-string key.
    console.error('JWT_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(accessToken, secret, { algorithms: ['HS256'] });

    // Reject MFA-pending tokens on non-MFA routes
    if ((payload as Record<string, unknown>).mfaPending) {
      if (!pathname.startsWith('/mfa') && !pathname.startsWith('/api/auth/mfa')) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'MFA verification required' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/mfa', request.url));
      }
      requestHeaders.set('x-mfa-pending', '1');
    }

    // An account still on a known/default credential is confined to the
    // change-password flow (plus logout) until it picks a new one.
    if (
      (payload as Record<string, unknown>).mustChangePassword &&
      !pathname.startsWith('/change-password') &&
      !pathname.startsWith('/api/auth/change-password')
    ) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Password change required' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/change-password', request.url));
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
