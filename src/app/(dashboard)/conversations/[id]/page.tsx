'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { MESSAGE_ROLE_COLORS } from '@/lib/constants/status';

interface AiSuggestion {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  content: string | null;
  error: string | null;
  model: string | null;
  data: { citations?: { id: string; title: string; slug: string }[] } | null;
}

/** How often to check whether the worker has finished a queued draft. */
const DRAFT_POLL_MS = 2000;

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

  const [draft, setDraft] = useState<AiSuggestion | null>(null);
  const [draftError, setDraftError] = useState('');
  const [drafting, setDrafting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollDraft = useCallback(async () => {
    try {
      const { suggestion } = await apiFetch<{ suggestion: AiSuggestion | null }>(
        `/api/conversations/${conversationId}/suggest-reply`,
      );
      setDraft(suggestion);
      if (suggestion?.status === 'PENDING') {
        pollTimer.current = setTimeout(pollDraft, DRAFT_POLL_MS);
      } else {
        setDrafting(false);
        if (suggestion?.status === 'FAILED') {
          setDraftError(suggestion.error || 'The AI worker could not draft a reply');
        }
      }
    } catch (err) {
      setDrafting(false);
      setDraftError(err instanceof ApiError ? err.message : 'Network error');
    }
  }, [conversationId]);

  // Stop polling when the page unmounts mid-generation.
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  async function handleDraft() {
    setDraftError('');
    setDrafting(true);
    try {
      const suggestion = await apiFetch<AiSuggestion>(
        `/api/conversations/${conversationId}/suggest-reply`,
        { method: 'POST' },
      );
      setDraft(suggestion);
      pollTimer.current = setTimeout(pollDraft, DRAFT_POLL_MS);
    } catch (err) {
      setDrafting(false);
      setDraftError(err instanceof ApiError ? err.message : 'Network error');
    }
  }

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

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">AI draft reply</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Grounded in your published knowledge base. Review before sending.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleDraft} disabled={drafting}>
            {drafting ? 'Drafting…' : 'Draft reply'}
          </Button>
        </div>

        {draftError && (
          <Alert tone="error" className="mt-3">
            {draftError}
          </Alert>
        )}

        {drafting && !draftError && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Generating a draft — this runs in the background and can take a moment.
          </p>
        )}

        {draft?.status === 'READY' && draft.content && (
          <div className="mt-3">
            <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
              {draft.content}
            </p>
            {draft.data?.citations && draft.data.citations.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Sources:{' '}
                {draft.data.citations.map((citation, index) => (
                  <span key={citation.id}>
                    {index > 0 && ', '}
                    <Link href={`/kb/${citation.id}`} className="hover:underline">
                      {citation.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={() => setNewMessage(draft.content ?? '')}>
                Use this draft
              </Button>
              {draft.model && (
                <span className="text-xs text-zinc-400">Generated by {draft.model}</span>
              )}
            </div>
          </div>
        )}
      </div>

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
