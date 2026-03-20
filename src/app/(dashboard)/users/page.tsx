'use client';

import { useState } from 'react';

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

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TENANT_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  SUPERVISOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  AGENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CUSTOMER: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  INACTIVE: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

export default function UsersPage() {
  const [users] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'AGENT' as string,
  });
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create user');
        return;
      }
      setShowCreate(false);
      setForm({ email: '', password: '', displayName: '', role: 'AGENT' });
      window.location.reload();
    } catch {
      setError('Network error');
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
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add User
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New User</h2>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Display Name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="TENANT_ADMIN">Tenant Admin</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="AGENT">Agent</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Create User
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </form>
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
            {users.length === 0 ? (
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
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${ROLE_COLORS[user.role] || ''}`}>
                      {user.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[user.status] || ''}`}>
                      {user.status.replace(/_/g, ' ')}
                    </span>
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
