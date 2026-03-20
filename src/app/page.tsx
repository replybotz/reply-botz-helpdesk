import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 px-8 py-32 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Reply Botz HD
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          AI-first helpdesk system. Manage conversations, tickets, and knowledge — powered by AI.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
