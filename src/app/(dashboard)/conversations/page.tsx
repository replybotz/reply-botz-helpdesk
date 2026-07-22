'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { CHANNEL_LABELS, CONVERSATION_STATUS_COLORS } from '@/lib/constants/status';

interface Conversation {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
  customer: { displayName: string | null; email: string } | null;
  messages: { content: string; role: string; createdAt: string }[];
}

export default function ConversationsPage() {
  const router = useRouter();
  const { data, loading, error: loadError } = useApi<{ conversations: Conversation[] }>('/api/conversations');
  const conversations = data?.conversations ?? [];
  const [showCreate, setShowCreate] = useState(false);
  const [channel, setChannel] = useState('LIVE_CHAT');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const conversation = await apiFetch<{ id: string }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ channel }),
      });
      router.push(`/conversations/${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
      setSaving(false);
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
        <Button onClick={() => setShowCreate(!showCreate)}>New Conversation</Button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Start Conversation</h2>
          {error && (
            <Alert tone="error" className="mb-4">
              {error}
            </Alert>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="conversation-channel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Channel
              </label>
              <select
                id="conversation-channel"
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
              <Button type="submit" disabled={saving}>
                {saving ? 'Starting…' : 'Start'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}

      {loadError && (
        <Alert tone="error" className="mt-6">
          Failed to load conversations: {loadError}
        </Alert>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Loading conversations…</p>
          </div>
        ) : conversations.length === 0 ? (
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
                  <Badge className={CONVERSATION_STATUS_COLORS[conv.status]}>{conv.status}</Badge>
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
