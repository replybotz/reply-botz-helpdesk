'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  TICKET_STATUS_COLORS,
  TICKET_STATUS_OPTIONS,
  PRIORITY_COLORS,
  PRIORITY_OPTIONS,
  formatEnum,
} from '@/lib/constants/status';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  assignee: { id: string; displayName: string | null; email: string } | null;
  conversation: {
    id: string;
    channel: string;
    status: string;
    customer: { id: string; displayName: string | null; email: string } | null;
  } | null;
}

const inputClasses =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50';

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const { data: ticket, loading, error: loadError, reload } = useApi<Ticket>(`/api/tickets/${ticketId}`);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: '', priority: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ticket) {
      setForm({ status: ticket.status, priority: ticket.priority });
    }
  }, [ticket]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: form.status, priority: form.priority }),
      });
      setSuccess('Ticket updated');
      setEditing(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/tickets" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          &larr; Back to Tickets
        </Link>
      </div>

      {loadError && <Alert tone="error">Failed to load ticket: {loadError}</Alert>}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading ticket…</p>
        ) : !ticket ? (
          !loadError && <p className="text-sm text-zinc-500">Ticket not found.</p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{ticket.subject}</h1>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{formatEnum(ticket.status)}</Badge>
                  <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
                  <span className="text-xs text-zinc-500">
                    Created {new Date(ticket.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {ticket.description}
            </p>

            <dl className="mt-6 grid gap-4 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-2 dark:border-zinc-800">
              <div>
                <dt className="font-medium text-zinc-500">Assignee</dt>
                <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
                  {ticket.assignee?.displayName || ticket.assignee?.email || 'Unassigned'}
                </dd>
              </div>
              {ticket.conversation && (
                <div>
                  <dt className="font-medium text-zinc-500">Conversation</dt>
                  <dd className="mt-1">
                    <Link
                      href={`/conversations/${ticket.conversation.id}`}
                      className="text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {ticket.conversation.customer?.displayName ||
                        ticket.conversation.customer?.email ||
                        'View conversation'}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>

            {error && (
              <Alert tone="error" className="mt-4">
                {error}
              </Alert>
            )}
            {success && (
              <Alert tone="success" className="mt-4">
                {success}
              </Alert>
            )}

            {editing && (
              <form onSubmit={handleUpdate} className="mt-6 space-y-4 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                <div>
                  <label htmlFor="ticket-status" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Status
                  </label>
                  <select
                    id="ticket-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className={inputClasses}
                  >
                    {TICKET_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {formatEnum(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ticket-priority" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Priority
                  </label>
                  <select
                    id="ticket-priority"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className={inputClasses}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {formatEnum(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Updating…' : 'Update Ticket'}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
