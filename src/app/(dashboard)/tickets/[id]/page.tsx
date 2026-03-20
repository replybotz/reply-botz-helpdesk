'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const STATUS_OPTIONS = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_CUSTOMER',
  'WAITING_ON_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
];

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: '', priority: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const updates: Record<string, string> = {};
      if (form.status) updates.status = form.status;
      if (form.priority) updates.priority = form.priority;

      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update');
        return;
      }
      setSuccess('Ticket updated');
      setEditing(false);
    } catch {
      setError('Network error');
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/tickets" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          &larr; Back to Tickets
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Ticket #{ticketId.slice(0, 8)}</h1>
            <p className="mt-1 text-sm text-zinc-500">Ticket detail view</p>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-4 text-sm text-green-600">{success}</p>}

        {editing && (
          <form onSubmit={handleUpdate} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">No change</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">No change</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Update Ticket
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
