'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_LEAD' | 'AGENT' | 'INSTRUCTOR' | 'STUDENT' | 'PARENT';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface PaginatedResponse {
  data: OrgUser[];
  total: number;
  page: number;
  limit: number;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  ADMIN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  TEAM_LEAD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  AGENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  INSTRUCTOR: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  STUDENT: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  PARENT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" /></td>
      ))}
    </tr>
  );
}

export default function UsersSettingsPage() {
  const { user: authUser } = useAuthStore();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');

  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('AGENT');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const [deactivating, setDeactivating] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (roleFilter) params.role = roleFilter;
      const res = await apiClient.get('/users', { params });
      const result: PaginatedResponse = res.data.data;
      setUsers(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to load users. Admin access required.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      await apiClient.post('/users', {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setCreateSuccess(true);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('AGENT');
      fetchUsers();
      setTimeout(() => { setShowNewModal(false); setCreateSuccess(false); }, 1500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setCreateError(e.response?.data?.message ?? 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (userId === authUser?.id) return;
    setDeactivating(userId);
    try {
      await apiClient.delete(`/users/${userId}`);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Failed to deactivate user.');
    } finally {
      setDeactivating(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users & Agents</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {total > 0 ? `${total.toLocaleString()} users in your organization` : 'Manage team members and their roles'}
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
          + Invite User
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="TEAM_LEAD">Team Lead</option>
          <option value="AGENT">Agent</option>
          <option value="INSTRUCTOR">Instructor</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
          <button onClick={fetchUsers} className="ml-3 underline font-medium">Retry</button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">User</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Role</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">2FA</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Joined</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {u.name}
                            {u.id === authUser?.id && (
                              <span className="text-xs text-gray-400 font-normal">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {u.role.replace('_', ' ').charAt(0) + u.role.replace('_', ' ').slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.mfaEnabled ? (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Enabled</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      {u.id !== authUser?.id && u.isActive && (
                        <button
                          onClick={() => handleDeactivate(u.id)}
                          disabled={deactivating === u.id}
                          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors disabled:opacity-50"
                        >
                          {deactivating === u.id ? 'Deactivating...' : 'Deactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages} &middot; {total.toLocaleString()} total</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">Previous</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Invite User Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Invite User</h2>
            {createError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">{createError}</div>
            )}
            {createSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                User created successfully!
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jane Smith"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jane@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password <span className="text-red-500">*</span></label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="AGENT">Agent</option>
                  <option value="TEAM_LEAD">Team Lead</option>
                  <option value="ADMIN">Admin</option>
                  <option value="INSTRUCTOR">Instructor</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => { setShowNewModal(false); setCreateError(null); setCreateSuccess(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={isCreating || !newName.trim() || !newEmail.trim() || newPassword.length < 8}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
                {isCreating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
