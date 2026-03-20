'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Conversation {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
  customer: { displayName: string | null; email: string } | null;
  messages: { content: string; role: string; createdAt: string }[];
}

const CHANNEL_LABELS: Record<string, string> = {
  LIVE_CHAT: 'Live Chat',
  EMAIL: 'Email',
  VOICE: 'Voice',
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
  TELEGRAM: 'Telegram',
  SLACK: 'Slack',
  TWITTER: 'Twitter',
  API: 'API',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ASSIGNED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PENDING: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOSED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
};

export default function ConversationsPage() {
  const [conversations] = useState<Conversation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [channel, setChannel] = useState('LIVE_CHAT');
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create conversation');
        return;
      }
      const data = await res.json();
      window.location.href = `/conversations/${data.id}`;
    } catch {
      setError('Network error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Conversations</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage customer conversations across all channels.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New Conversation
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Start Conversation</h2>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
              >
                Start
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {conversations.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No conversations yet. Start a new conversation to begin.</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/conversations/${conv.id}`}
              className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {conv.customer?.displayName || conv.customer?.email || 'Unknown'}
                  </span>
                  <span className="text-xs text-zinc-500">{CHANNEL_LABELS[conv.channel] || conv.channel}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[conv.status] || ''}`}>
                    {conv.status}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">{new Date(conv.createdAt).toLocaleDateString()}</span>
              </div>
              {conv.messages[0] && (
                <p className="mt-2 truncate text-sm text-zinc-600 dark:text-zinc-400">{conv.messages[0].content}</p>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
