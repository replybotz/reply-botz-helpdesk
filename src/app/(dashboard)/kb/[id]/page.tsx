'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ArticleDetailPage() {
  const params = useParams();
  const articleId = params.id as string;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', status: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const updates: Record<string, string> = {};
      if (form.title) updates.title = form.title;
      if (form.content) updates.content = form.content;
      if (form.status) updates.status = form.status;

      const res = await fetch(`/api/kb/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update');
        return;
      }
      setSuccess('Article updated');
      setEditing(false);
    } catch {
      setError('Network error');
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/kb" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          &larr; Back to Knowledge Base
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Article #{articleId.slice(0, 8)}</h1>
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">No change</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Update Article
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
