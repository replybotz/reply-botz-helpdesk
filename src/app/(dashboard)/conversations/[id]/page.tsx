'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  content: string;
  role: string;
  createdAt: string;
  sender?: { displayName: string | null; email: string; role: string } | null;
}

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-50 dark:bg-blue-950',
  AGENT: 'bg-white dark:bg-zinc-900',
  AI: 'bg-purple-50 dark:bg-purple-950',
  SYSTEM: 'bg-zinc-50 dark:bg-zinc-950',
};

export default function ConversationDetailPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const [messages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setError('');

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send');
        return;
      }
      setNewMessage('');
      window.location.reload();
    } catch {
      setError('Network error');
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
            Conversation #{conversationId.slice(0, 8)}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            No messages yet. Send a message to start the conversation.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 ${ROLE_COLORS[msg.role] || ''}`}>
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

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Send
        </button>
      </form>
    </div>
  );
}
