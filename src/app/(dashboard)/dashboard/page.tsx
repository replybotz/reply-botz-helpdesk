'use client';

import Link from 'next/link';
import { useApi } from '@/lib/api/use-api';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TICKET_STATUS_COLORS, PRIORITY_COLORS, formatEnum } from '@/lib/constants/status';

interface Analytics {
  tickets: { total: number; open: number; inProgress: number; resolved: number; urgent: number };
  conversations: { total: number; active: number };
  knowledgeBase: { total: number; published: number };
  users: { total: number; activeAgents: number };
  recentTickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    assignee: { displayName: string | null } | null;
  }[];
}

const quickActions = [
  { label: 'Create Ticket', href: '/tickets', description: 'Open a new support ticket' },
  { label: 'New Conversation', href: '/conversations', description: 'Start a customer conversation' },
  { label: 'Write Article', href: '/kb', description: 'Create a knowledge base article' },
  { label: 'Add User', href: '/users', description: 'Invite a new team member' },
];

export default function DashboardPage() {
  const { data, loading, error } = useApi<Analytics>('/api/analytics');

  const statCards = [
    {
      label: 'Open Tickets',
      value: data?.tickets.open,
      href: '/tickets',
      description: 'Tickets awaiting resolution',
    },
    {
      label: 'Active Conversations',
      value: data?.conversations.active,
      href: '/conversations',
      description: 'Ongoing customer conversations',
    },
    {
      label: 'KB Articles',
      value: data?.knowledgeBase.published,
      href: '/kb',
      description: 'Published knowledge base articles',
    },
    {
      label: 'Team Members',
      value: data?.users.activeAgents,
      href: '/users',
      description: 'Active agents and supervisors',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome to Reply Botz HD. Your AI-powered helpdesk overview.
      </p>

      {error && (
        <Alert tone="error" className="mt-6">
          Failed to load dashboard stats: {error}
        </Alert>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {loading ? '…' : (stat.value ?? '--')}
            </p>
            <p className="mt-1 text-xs text-zinc-400">{stat.description}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Quick Actions</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="rounded-xl border border-zinc-200 bg-white p-4 text-center transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{action.label}</p>
            <p className="mt-1 text-xs text-zinc-500">{action.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Activity</h2>
        {loading ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : !data || data.recentTickets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Recent tickets will appear here once created.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.recentTickets.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-4 py-3">
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {ticket.subject}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{formatEnum(ticket.status)}</Badge>
                  <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
                  <span className="text-xs text-zinc-400">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
