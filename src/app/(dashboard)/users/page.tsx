'use client';

import { useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ROLE_COLORS, USER_STATUS_COLORS, formatEnum } from '@/lib/constants/status';

interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const inputClasses =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50';

export default function UsersPage() {
  const { data, loading, error: loadError, reload } = useApi<{ users: User[] }>('/api/users');
  const users = data?.users ?? [];
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'AGENT' as string,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false);
      setForm({ email: '', password: '', displayName: '', role: 'AGENT' });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Users</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage team members, agents, and customer accounts.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>Add User</Button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New User</h2>
          {error && (
            <Alert tone="error" className="mb-4">
              {error}
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="user-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label htmlFor="user-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Display Name
              </label>
              <input
                id="user-name"
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label htmlFor="user-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label htmlFor="user-role" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Role
              </label>
              <select
                id="user-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputClasses}
              >
                <option value="TENANT_ADMIN">Tenant Admin</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="AGENT">Agent</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loadError && (
        <Alert tone="error" className="mt-6">
          Failed to load users: {loadError}
        </Alert>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">MFA</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No users to display. Add a user to get started.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {user.displayName || 'No name'}
                      </p>
                      <p className="text-xs text-zinc-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={ROLE_COLORS[user.role]}>{formatEnum(user.role)}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={USER_STATUS_COLORS[user.status]}>{formatEnum(user.status)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
