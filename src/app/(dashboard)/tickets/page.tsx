'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { TICKET_STATUS_COLORS, PRIORITY_COLORS, PRIORITY_OPTIONS, formatEnum } from '@/lib/constants/status';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  assignee?: { displayName: string | null; email: string } | null;
}

const inputClasses =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50';

export default function TicketsPage() {
  const { data, loading, error: loadError, reload } = useApi<{ tickets: Ticket[] }>('/api/tickets');
  const tickets = data?.tickets ?? [];
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'MEDIUM' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false);
      setForm({ subject: '', description: '', priority: 'MEDIUM' });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Tickets</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage support tickets and track resolution progress.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>Create Ticket</Button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Ticket</h2>
          {error && (
            <Alert tone="error" className="mb-4">
              {error}
            </Alert>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="ticket-subject" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Subject
              </label>
              <input
                id="ticket-subject"
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label
                htmlFor="ticket-description"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Description
              </label>
              <textarea
                id="ticket-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className={inputClasses}
                required
              />
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
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
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
          Failed to load tickets: {loadError}
        </Alert>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Assignee</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                  Loading tickets…
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No tickets yet. Create your first ticket to get started.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-6 py-4">
                    <Link href={`/tickets/${ticket.id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{formatEnum(ticket.status)}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {ticket.assignee?.displayName || ticket.assignee?.email || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
