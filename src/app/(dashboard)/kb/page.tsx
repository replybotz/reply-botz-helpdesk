'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  tags: string[];
  views: number;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
};

export default function KnowledgeBasePage() {
  const [articles] = useState<Article[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', tags: '', status: 'DRAFT' as string });
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          tags: form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          status: form.status,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create article');
        return;
      }
      setShowCreate(false);
      setForm({ title: '', content: '', tags: '', status: 'DRAFT' });
      window.location.reload();
    } catch {
      setError('Network error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Knowledge Base</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create and manage help articles for customers and agents.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New Article
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Article</h2>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                placeholder="faq, getting-started, billing"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
              >
                Create Article
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

      <div className="mt-6 space-y-3">
        {articles.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No articles yet. Create your first knowledge base article.</p>
          </div>
        ) : (
          articles.map((article) => (
            <Link
              key={article.id}
              href={`/kb/${article.id}`}
              className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{article.title}</h3>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[article.status] || ''}`}>
                  {article.status}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                <span>{article.views} views</span>
                <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
                {article.tags.length > 0 && (
                  <div className="flex gap-1">
                    {article.tags.map((tag) => (
                      <span key={tag} className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
