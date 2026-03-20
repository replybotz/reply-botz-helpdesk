export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome to Reply Botz HD. Your AI-powered helpdesk overview will appear here.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Open Tickets', value: '0' },
          { label: 'Active Conversations', value: '0' },
          { label: 'KB Articles', value: '0' },
          { label: 'Agents Online', value: '0' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
