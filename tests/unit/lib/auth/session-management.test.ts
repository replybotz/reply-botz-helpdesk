const mockPrisma = {
  session: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@/lib/db', () => ({ prisma: mockPrisma }));

import { listUserSessions, revokeUserSession, purgeStaleSessions } from '@/lib/auth/session';

beforeEach(() => jest.clearAllMocks());

describe('listUserSessions', () => {
  it('returns only the user\'s live sessions and never the token hash', async () => {
    mockPrisma.session.findMany.mockResolvedValue([]);

    await listUserSessions('user-1');

    const [[args]] = mockPrisma.session.findMany.mock.calls;
    expect(args.where.userId).toBe('user-1');
    expect(args.where.revokedAt).toBeNull();
    expect(args.where.expiresAt.gt).toBeInstanceOf(Date);
    // The stored refresh-token hash must never be selectable by the client.
    expect(args.select.refreshToken).toBeUndefined();
  });
});

describe('revokeUserSession', () => {
  it('scopes the revoke to the calling user', async () => {
    mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

    await expect(revokeUserSession('user-1', 'session-9')).resolves.toBe(true);

    const [[args]] = mockPrisma.session.updateMany.mock.calls;
    expect(args.where).toMatchObject({ id: 'session-9', userId: 'user-1', revokedAt: null });
    expect(args.data.revokedAt).toBeInstanceOf(Date);
  });

  it('reports failure when the session belongs to someone else', async () => {
    // updateMany matches nothing rather than throwing — that is what stops one
    // user revoking another's session.
    mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });

    await expect(revokeUserSession('user-1', 'someone-elses')).resolves.toBe(false);
  });

  it('is idempotent for an already-revoked session', async () => {
    mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });
    await expect(revokeUserSession('user-1', 'session-9')).resolves.toBe(false);
  });
});

describe('purgeStaleSessions', () => {
  it('deletes expired rows only, preserving revoked ones inside their window', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 4 });

    await expect(purgeStaleSessions()).resolves.toBe(4);

    const [[args]] = mockPrisma.session.deleteMany.mock.calls;
    expect(args.where.expiresAt.lt).toBeInstanceOf(Date);
    // Revoked-but-unexpired rows are what reuse detection reads; deleting them
    // early would silently disable theft detection.
    expect(args.where.revokedAt).toBeUndefined();
  });
});
