'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

type ConversationStatus = 'ACTIVE' | 'WAITING' | 'RESOLVED' | 'CLOSED';
type ConversationChannel = 'EMAIL' | 'CHAT' | 'WHATSAPP' | 'SLACK' | 'DISCORD' | 'API';

interface Conversation {
  id: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  customer?: {
    id: string;
    name?: string;
    email?: string;
  };
  assignedAgent?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  WAITING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  RESOLVED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  CLOSED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  EMAIL: 'Email',
  CHAT: 'Chat',
  WHATSAPP: 'WhatsApp',
  SLACK: 'Slack',
  DISCORD: 'Discord',
  API: 'API',
};

function StatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [showNewModal, setShowNewModal] = useState(false);
  const [newChannel, setNewChannel] = useState<ConversationChannel>('CHAT');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (channelFilter) params.channel = channelFilter;
      if (search) params.search = search;

      const response = await apiClient.get('/conversations', { params });
      const result: PaginatedResponse = response.data.data;
      setConversations(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to load conversations.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, channelFilter, search]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleCreateConversation = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      await apiClient.post('/conversations', {
        channel: newChannel,
        customerEmail: newCustomerEmail || undefined,
      });
      setShowNewModal(false);
      setNewCustomerEmail('');
      setNewChannel('CHAT');
      fetchConversations();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setCreateError(e.response?.data?.message ?? 'Failed to create conversation.');
    } finally {
      setIsCreating(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conversations</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {total > 0 ? `${total.toLocaleString()} total conversations` : 'Manage customer conversations'}
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Conversation
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); handleFilterChange(); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="WAITING">Waiting</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value); handleFilterChange(); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All Channels</option>
          <option value="EMAIL">Email</option>
          <option value="CHAT">Chat</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SLACK">Slack</option>
          <option value="DISCORD">Discord</option>
          <option value="API">API</option>
        </select>

        <div className="flex gap-2 flex-1 min-w-48">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search conversations..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
          <button onClick={fetchConversations} className="ml-3 underline font-medium">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">ID</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Channel</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Customer</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Agent</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : conversations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                    No conversations found
                  </td>
                </tr>
              ) : (
                conversations.map((conv) => (
                  <tr
                    key={conv.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/conversations/${conv.id}`}
                        className="font-mono text-blue-600 dark:text-blue-400 hover:underline text-xs"
                      >
                        {conv.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {CHANNEL_LABELS[conv.channel] ?? conv.channel}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={conv.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {conv.customer?.name ?? conv.customer?.email ?? (
                        <span className="text-gray-400 dark:text-gray-500 italic">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {conv.assignedAgent?.name ?? (
                        <span className="text-gray-400 dark:text-gray-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(conv.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages} &middot; {total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Conversation</h2>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Channel
                </label>
                <select
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value as ConversationChannel)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="CHAT">Chat</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SLACK">Slack</option>
                  <option value="DISCORD">Discord</option>
                  <option value="API">API</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => { setShowNewModal(false); setCreateError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
