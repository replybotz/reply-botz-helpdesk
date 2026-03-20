import Link from 'next/link';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Conversations', href: '/conversations' },
  { name: 'Tickets', href: '/tickets' },
  { name: 'Knowledge Base', href: '/kb' },
  { name: 'Settings', href: '/settings' },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Reply Botz HD</span>
      </div>
      <nav className="mt-4 space-y-1 px-3">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
