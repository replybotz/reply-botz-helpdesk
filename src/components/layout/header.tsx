export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">AI Helpdesk</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </header>
  );
}
