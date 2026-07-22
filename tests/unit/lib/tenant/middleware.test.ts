import { resolveTenantSlug } from '@/lib/tenant/middleware';
import { NextRequest } from 'next/server';

describe('Tenant resolution middleware', () => {
  function createRequest(opts: { host?: string; tenantHeader?: string; tenantQuery?: string } = {}) {
    const url = opts.tenantQuery
      ? `http://localhost:3000/test?tenant=${opts.tenantQuery}`
      : 'http://localhost:3000/test';

    const headers = new Headers();
    if (opts.host) headers.set('host', opts.host);
    if (opts.tenantHeader) headers.set('x-tenant-slug', opts.tenantHeader);

    return new NextRequest(new Request(url, { headers }));
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_DOMAIN = 'replybotz.localhost';
  });

  it('should resolve tenant from subdomain', () => {
    const req = createRequest({ host: 'acme.replybotz.localhost' });
    expect(resolveTenantSlug(req)).toBe('acme');
  });

  it('should resolve tenant from X-Tenant-Slug header', () => {
    const req = createRequest({ host: 'replybotz.localhost', tenantHeader: 'demo' });
    expect(resolveTenantSlug(req)).toBe('demo');
  });

  it('should resolve tenant from query parameter', () => {
    const req = createRequest({ host: 'replybotz.localhost', tenantQuery: 'test-org' });
    expect(resolveTenantSlug(req)).toBe('test-org');
  });

  it('should prioritize subdomain over header', () => {
    const req = createRequest({ host: 'acme.replybotz.localhost', tenantHeader: 'other' });
    expect(resolveTenantSlug(req)).toBe('acme');
  });

  it('should return null for base domain', () => {
    const req = createRequest({ host: 'replybotz.localhost' });
    expect(resolveTenantSlug(req)).toBeNull();
  });

  it('should return null with no tenant identifiers', () => {
    const req = createRequest({ host: 'some-other-domain.com' });
    expect(resolveTenantSlug(req)).toBeNull();
  });
});
