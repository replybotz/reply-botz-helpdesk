'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ARTICLE_STATUS_COLORS } from '@/lib/constants/status';

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  tags: string[];
  views: number;
  updatedAt: string;
}

const inputClasses =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50';

export default function KnowledgeBasePage() {
  const { data, loading, error: loadError, reload } = useApi<{ articles: Article[] }>('/api/kb');
  const articles = data?.articles ?? [];
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', tags: '', status: 'DRAFT' as string });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiFetch('/api/kb', {
        method: 'POST',
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
      setShowCreate(false);
      setForm({ title: '', content: '', tags: '', status: 'DRAFT' });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setSaving(false);
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
        <Button onClick={() => setShowCreate(!showCreate)}>New Article</Button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Article</h2>
          {error && (
            <Alert tone="error" className="mb-4">
              {error}
            </Alert>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="article-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Title
              </label>
              <input
                id="article-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label htmlFor="article-content" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Content
              </label>
              <textarea
                id="article-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label htmlFor="article-tags" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tags (comma-separated)
              </label>
              <input
                id="article-tags"
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className={inputClasses}
                placeholder="faq, getting-started, billing"
              />
            </div>
            <div>
              <label htmlFor="article-status" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Status
              </label>
              <select
                id="article-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClasses}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Article'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}

      {loadError && (
        <Alert tone="error" className="mt-6">
          Failed to load articles: {loadError}
        </Alert>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Loading articles…</p>
          </div>
        ) : articles.length === 0 ? (
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
                <Badge className={ARTICLE_STATUS_COLORS[article.status]}>{article.status}</Badge>
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
