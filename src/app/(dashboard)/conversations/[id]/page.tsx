'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { MESSAGE_ROLE_COLORS } from '@/lib/constants/status';

interface Message {
  id: string;
  content: string;
  role: string;
  createdAt: string;
  sender?: { displayName: string | null; email: string; role: string } | null;
}

interface Conversation {
  id: string;
  channel: string;
  status: string;
  customer: { id: string; displayName: string | null; email: string } | null;
  messages: Message[];
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const {
    data: conversation,
    loading,
    error: loadError,
    reload,
  } = useApi<Conversation>(`/api/conversations/${conversationId}`);
  const messages = conversation?.messages ?? [];
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setError('');
    setSending(true);

    try {
      await apiFetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage }),
      });
      setNewMessage('');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/conversations" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            &larr; Back to Conversations
          </Link>
          <h1 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {conversation?.customer?.displayName ||
              conversation?.customer?.email ||
              `Conversation #${conversationId.slice(0, 8)}`}
          </h1>
        </div>
      </div>

      {loadError && (
        <Alert tone="error" className="mb-4">
          Failed to load conversation: {loadError}
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <p className="py-12 text-center text-sm text-zinc-500">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            No messages yet. Send a message to start the conversation.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 ${MESSAGE_ROLE_COLORS[msg.role] || ''}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {msg.sender?.displayName || msg.sender?.email || msg.role}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-900 dark:text-zinc-50 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <Alert tone="error" className="mt-2">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <label htmlFor="message-input" className="sr-only">
          Message
        </label>
        <input
          id="message-input"
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <Button type="submit" size="lg" disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
