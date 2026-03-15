'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

interface Customer {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  lmsUserId?: string;
  lmsPlatform?: string;
  conversationCount?: number;
  ticketCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" /></td>
      ))}
    </tr>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [showNewModal, setShowNewModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLmsUserId, setNewLmsUserId] = useState('');
  const [newLmsPlatform, setNewLmsPlatform] = useState('');
  const [newRole, setNewRole] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await apiClient.get('/customers', { params });
      const result: PaginatedResponse = res.data.data;
      setCustomers(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to load customers.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, roleFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      await apiClient.post('/customers', {
        email: newEmail.trim() || undefined,
        name: newName.trim() || undefined,
        phone: newPhone.trim() || undefined,
        lmsUserId: newLmsUserId.trim() || undefined,
        lmsPlatform: newLmsPlatform.trim() || undefined,
        role: newRole || undefined,
      });
      setShowNewModal(false);
      setNewEmail(''); setNewName(''); setNewPhone(''); setNewLmsUserId(''); setNewLmsPlatform(''); setNewRole('');
      fetchCustomers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setCreateError(e.response?.data?.message ?? 'Failed to create customer.');
    } finally {
      setIsCreating(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {total > 0 ? `${total.toLocaleString()} total customers` : 'Manage your customer base'}
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
          + New Customer
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Roles</option>
          <option value="STUDENT">Student</option>
          <option value="PARENT">Parent</option>
          <option value="INSTRUCTOR">Instructor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <div className="flex gap-2 flex-1 min-w-48">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name or email..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          <button onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors">
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
          <button onClick={fetchCustomers} className="ml-3 underline font-medium">Retry</button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Customer</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Role</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">LMS</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Conversations</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Tickets</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No customers found</td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/customers/${c.id}`} className="group">
                        <p className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {c.name ?? <span className="italic text-gray-400">Unknown</span>}
                        </p>
                        {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                        {c.phone && <p className="text-xs text-gray-400 dark:text-gray-500">{c.phone}</p>}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {c.role ? (
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 text-xs rounded-full font-medium">
                          {c.role.charAt(0) + c.role.slice(1).toLowerCase()}
                        </span>
                      ) : <span className="text-gray-400 italic text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                      {c.lmsPlatform ? (
                        <div>
                          <p className="font-medium">{c.lmsPlatform}</p>
                          {c.lmsUserId && <p className="text-gray-400 font-mono">{c.lmsUserId.slice(0, 12)}...</p>}
                        </div>
                      ) : <span className="italic">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{c.conversationCount ?? 0}</td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{c.ticketCount ?? 0}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</td>
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

      {/* New Customer Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Customer</h2>
            {createError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">{createError}</div>
            )}
            <div className="space-y-3">
              {[
                { label: 'Name', value: newName, set: setNewName, placeholder: 'Full name' },
                { label: 'Email', value: newEmail, set: setNewEmail, placeholder: 'email@example.com' },
                { label: 'Phone', value: newPhone, set: setNewPhone, placeholder: '+1 (555) 000-0000' },
                { label: 'LMS User ID', value: newLmsUserId, set: setNewLmsUserId, placeholder: 'External LMS user ID' },
                { label: 'LMS Platform', value: newLmsPlatform, set: setNewLmsPlatform, placeholder: 'e.g. canvas, moodle' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label} <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="text" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">No role</option>
                  <option value="STUDENT">Student</option>
                  <option value="PARENT">Parent</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => { setShowNewModal(false); setCreateError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={isCreating || (!newEmail.trim() && !newName.trim())}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
