import Link from 'next/link';

const statCards = [
  { label: 'Open Tickets', value: '--', href: '/tickets', description: 'Tickets awaiting resolution' },
  { label: 'Active Conversations', value: '--', href: '/conversations', description: 'Ongoing customer conversations' },
  { label: 'KB Articles', value: '--', href: '/kb', description: 'Published knowledge base articles' },
  { label: 'Team Members', value: '--', href: '/users', description: 'Active agents and supervisors' },
];

const quickActions = [
  { label: 'Create Ticket', href: '/tickets', description: 'Open a new support ticket' },
  { label: 'New Conversation', href: '/conversations', description: 'Start a customer conversation' },
  { label: 'Write Article', href: '/kb', description: 'Create a knowledge base article' },
  { label: 'Add User', href: '/users', description: 'Invite a new team member' },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome to Reply Botz HD. Your AI-powered helpdesk overview.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{stat.value}</p>
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
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Recent tickets, conversations, and events will appear here once connected to a database.
        </p>
      </div>
    </div>
  );
}
