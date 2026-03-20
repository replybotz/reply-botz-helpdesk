'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  assignee?: { displayName: string | null; email: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  WAITING_ON_CUSTOMER: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  WAITING_ON_THIRD_PARTY: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOSED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
};

export default function TicketsPage() {
  const [tickets] = useState<Ticket[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'MEDIUM' });
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create ticket');
        return;
      }
      setShowCreate(false);
      setForm({ subject: '', description: '', priority: 'MEDIUM' });
      window.location.reload();
    } catch {
      setError('Network error');
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
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Create Ticket
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Ticket</h2>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
              >
                Create
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
            {tickets.length === 0 ? (
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
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[ticket.status] || ''}`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || ''}`}>
                      {ticket.priority}
                    </span>
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
