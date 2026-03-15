'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Conversation {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

type TabId = 'overview' | 'conversations' | 'tickets';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([
      apiClient.get(`/customers/${id}`),
      apiClient.get(`/customers/${id}/conversations`),
      apiClient.get(`/customers/${id}/tickets`),
    ])
      .then(([cRes, convRes, ticketRes]) => {
        const c: Customer = cRes.data.data;
        setCustomer(c);
        setEditName(c.name ?? '');
        setEditEmail(c.email ?? '');
        setEditPhone(c.phone ?? '');
        setConversations(convRes.data.data ?? []);
        setTickets(ticketRes.data.data ?? []);
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message ?? 'Failed to load customer.');
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!customer) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await apiClient.patch(`/customers/${id}`, {
        name: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
      });
      setCustomer(res.data.data);
      setIsEditing(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSaveError(e.response?.data?.message ?? 'Failed to update customer.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error ?? 'Customer not found.'}
          <button onClick={() => router.back()} className="ml-3 underline font-medium">Go back</button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'conversations', label: 'Conversations', count: conversations.length },
    { id: 'tickets', label: 'Tickets', count: tickets.length },
  ];

  const CONV_STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'text-green-600 dark:text-green-400',
    WAITING: 'text-yellow-600 dark:text-yellow-400',
    RESOLVED: 'text-gray-500',
    CLOSED: 'text-gray-400',
  };

  const TICKET_PRIORITY_COLOR: Record<string, string> = {
    URGENT: 'text-red-600 dark:text-red-400',
    HIGH: 'text-orange-600 dark:text-orange-400',
    NORMAL: 'text-blue-600 dark:text-blue-400',
    LOW: 'text-gray-500',
  };

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/customers" className="hover:text-blue-600 dark:hover:text-blue-400">Customers</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">{customer.name ?? customer.email ?? customer.id.slice(0, 8)}</span>
      </div>

      {/* Profile header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl font-bold">
              {(customer.name ?? customer.email ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {customer.name ?? <span className="italic text-gray-400">No name</span>}
              </h1>
              {customer.email && <p className="text-gray-500 dark:text-gray-400 text-sm">{customer.email}</p>}
              {customer.phone && <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">{customer.phone}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {customer.role && (
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 text-xs rounded-full font-medium">
                    {customer.role.charAt(0) + customer.role.slice(1).toLowerCase()}
                  </span>
                )}
                {customer.lmsPlatform && (
                  <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 text-xs rounded-full font-medium">
                    {customer.lmsPlatform}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {isEditing && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            {saveError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">{saveError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Name', value: editName, set: setEditName, placeholder: 'Full name' },
                { label: 'Email', value: editEmail, set: setEditEmail, placeholder: 'email@example.com' },
                { label: 'Phone', value: editPhone, set: setEditPhone, placeholder: '+1 (555) 000-0000' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                  <input type="text" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              ))}
            </div>
            <button onClick={handleSave} disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contact Info</h2>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex gap-2"><span className="font-medium w-16">Name</span><span>{customer.name ?? '—'}</span></div>
              <div className="flex gap-2"><span className="font-medium w-16">Email</span><span>{customer.email ?? '—'}</span></div>
              <div className="flex gap-2"><span className="font-medium w-16">Phone</span><span>{customer.phone ?? '—'}</span></div>
              <div className="flex gap-2"><span className="font-medium w-16">Role</span><span>{customer.role ?? '—'}</span></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">LMS Context</h2>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex gap-2"><span className="font-medium w-20">Platform</span><span>{customer.lmsPlatform ?? '—'}</span></div>
              <div className="flex gap-2"><span className="font-medium w-20">LMS ID</span><span className="font-mono text-xs">{customer.lmsUserId ?? '—'}</span></div>
              <div className="flex gap-2 mt-4"><span className="font-medium w-20">Joined</span><span>{new Date(customer.createdAt).toLocaleDateString()}</span></div>
              <div className="flex gap-2"><span className="font-medium w-20">Updated</span><span>{new Date(customer.updatedAt).toLocaleDateString()}</span></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:col-span-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Activity Summary</h2>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{conversations.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Conversations</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tickets.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tickets</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {conversations.length === 0 ? (
            <p className="p-8 text-center text-gray-400 dark:text-gray-500 italic">No conversations yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">ID</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Channel</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {conversations.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-3">
                      <Link href={`/dashboard/conversations/${c.id}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline text-xs">
                        {c.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{c.channel}</td>
                    <td className={`px-6 py-3 font-medium text-xs ${CONV_STATUS_COLOR[c.status] ?? 'text-gray-500'}`}>{c.status}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {tickets.length === 0 ? (
            <p className="p-8 text-center text-gray-400 dark:text-gray-500 italic">No tickets yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">#</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Subject</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Priority</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-3">
                      <Link href={`/dashboard/tickets/${t.id}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline text-xs">
                        #{t.ticketNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate">
                      <Link href={`/dashboard/tickets/${t.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">{t.subject}</Link>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400 text-xs">{t.status.replace(/_/g, ' ')}</td>
                    <td className={`px-6 py-3 text-xs font-medium ${TICKET_PRIORITY_COLOR[t.priority] ?? 'text-gray-500'}`}>{t.priority}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
