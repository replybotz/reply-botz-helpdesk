const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
const ACCESS_MAX_AGE = 15 * 60;

// `Secure` would prevent the browser from sending cookies over plain-http
// local development, so it is only emitted in production.
function secureFlag(): string {
  return process.env.NODE_ENV === 'production' ? ' Secure;' : '';
}

export function accessTokenCookie(token: string, maxAge = ACCESS_MAX_AGE): string {
  return `accessToken=${token}; HttpOnly;${secureFlag()} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function refreshTokenCookie(token: string): string {
  return `refreshToken=${token}; HttpOnly;${secureFlag()} SameSite=Strict; Path=/api/auth; Max-Age=${REFRESH_MAX_AGE}`;
}

export function clearAuthCookies(): string[] {
  return [
    `accessToken=; HttpOnly;${secureFlag()} SameSite=Lax; Path=/; Max-Age=0`,
    `refreshToken=; HttpOnly;${secureFlag()} SameSite=Strict; Path=/api/auth; Max-Age=0`,
  ];
}

export function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken?: string; accessMaxAge?: number },
): Response {
  response.headers.append('Set-Cookie', accessTokenCookie(tokens.accessToken, tokens.accessMaxAge));
  if (tokens.refreshToken) {
    response.headers.append('Set-Cookie', refreshTokenCookie(tokens.refreshToken));
  }
  return response;
}

export function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Extract the bearer token for API auth: httpOnly cookie first (browser
 * clients), Authorization header as fallback (API clients).
 */
export function getAccessToken(request: Request): string | null {
  const fromCookie = getCookie(request, 'accessToken');
  if (fromCookie) return fromCookie;
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}
