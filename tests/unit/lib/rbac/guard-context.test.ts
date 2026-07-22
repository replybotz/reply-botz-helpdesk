const mockHeaders = new Map<string, string>();

jest.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => mockHeaders.get(key) ?? null,
  }),
}));

import { withPermission, type RouteHandlerContext } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';

function authedAs(role: string) {
  mockHeaders.set('x-user-id', 'user-1');
  mockHeaders.set('x-user-role', role);
  mockHeaders.set('x-tenant-id', 'tenant-1');
}

beforeEach(() => {
  mockHeaders.clear();
});

describe('withPermission route-context threading', () => {
  it('passes the Next route context through so handlers can await params', async () => {
    authedAs('TENANT_ADMIN');

    const handler = jest.fn(
      async (_req: Request, _ctx, routeCtx: RouteHandlerContext<{ id: string }>) => {
        const { id } = await routeCtx.params;
        return Response.json({ id });
      },
    );

    const wrapped = withPermission<{ id: string }>(Permission.TICKET_READ, handler);
    const routeCtx = { params: Promise.resolve({ id: 'abc-123' }) };
    const res = await wrapped(new Request('http://x/api/tickets/abc-123'), routeCtx);

    expect(handler).toHaveBeenCalled();
    expect(await res.json()).toEqual({ id: 'abc-123' });
  });

  it('returns 401 when identity headers are missing', async () => {
    const wrapped = withPermission(Permission.TICKET_READ, async () => Response.json({}));
    const res = await wrapped(new Request('http://x'), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when the role lacks the permission', async () => {
    authedAs('CUSTOMER');
    const wrapped = withPermission(Permission.USER_DELETE, async () => Response.json({}));
    const res = await wrapped(new Request('http://x'), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });
});
