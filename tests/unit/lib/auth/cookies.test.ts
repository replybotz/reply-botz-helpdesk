import {
  accessTokenCookie,
  refreshTokenCookie,
  clearAuthCookies,
  setAuthCookies,
  getCookie,
  getAccessToken,
} from '@/lib/auth/cookies';

describe('auth cookies', () => {
  it('access token cookie is httpOnly, Lax, app-wide', () => {
    const cookie = accessTokenCookie('tok123');
    expect(cookie).toContain('accessToken=tok123');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/;');
  });

  it('refresh token cookie is scoped to /api/auth with Strict', () => {
    const cookie = refreshTokenCookie('ref456');
    expect(cookie).toContain('refreshToken=ref456');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
  });

  it('setAuthCookies appends both cookies to the response', () => {
    const res = Response.json({});
    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' });
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('accessToken=a'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken=r'))).toBe(true);
  });

  it('clearAuthCookies expires both cookies', () => {
    for (const cookie of clearAuthCookies()) {
      expect(cookie).toContain('Max-Age=0');
    }
  });

  it('getCookie parses a specific cookie without prefix collisions', () => {
    const req = new Request('http://x', {
      headers: { cookie: 'xaccessToken=wrong; accessToken=right; other=1' },
    });
    expect(getCookie(req, 'accessToken')).toBe('right');
  });

  it('getAccessToken prefers the cookie and falls back to Bearer', () => {
    const cookieReq = new Request('http://x', {
      headers: { cookie: 'accessToken=fromcookie', authorization: 'Bearer fromheader' },
    });
    expect(getAccessToken(cookieReq)).toBe('fromcookie');

    const bearerReq = new Request('http://x', { headers: { authorization: 'Bearer fromheader' } });
    expect(getAccessToken(bearerReq)).toBe('fromheader');

    expect(getAccessToken(new Request('http://x'))).toBeNull();
  });
});
