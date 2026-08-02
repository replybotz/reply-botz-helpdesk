'use client';

import { useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

interface ActiveSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/** Shorten a user-agent to something a person can recognise. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : 'Browser';
  const os =
    /Windows/.test(userAgent) ? 'Windows'
    : /Macintosh|Mac OS/.test(userAgent) ? 'macOS'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'Unknown OS';
  return `${browser} on ${os}`;
}

export function ActiveSessions() {
  const { data, loading, error: loadError, reload } =
    useApi<{ sessions: ActiveSession[] }>('/api/auth/sessions');
  const sessions = data?.sessions ?? [];
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(id: string) {
    setError('');
    setRevoking(id);
    try {
      await apiFetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Active sessions</h3>
      <p className="mt-2 text-sm text-zinc-500">
        Devices currently signed in to your account. Revoking one signs that device out.
      </p>

      {(error || loadError) && (
        <Alert tone="error" className="mt-4">
          {error || loadError}
        </Alert>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No active sessions.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {describeDevice(session.userAgent)}
                  {session.isCurrent && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      This device
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {session.ipAddress ?? 'Unknown IP'} · signed in{' '}
                  {new Date(session.createdAt).toLocaleString()}
                </p>
              </div>
              {!session.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevoke(session.id)}
                  disabled={revoking === session.id}
                >
                  {revoking === session.id ? 'Revoking…' : 'Revoke'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
