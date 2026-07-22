'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  content: string;
  status: string;
  tags: string[];
  views: number;
  updatedAt: string;
}

const inputClasses =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50';

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const articleId = params.id;
  const { data: article, loading, error: loadError, reload } = useApi<Article>(`/api/kb/${articleId}`);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', status: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (article) {
      setForm({ title: article.title, content: article.content, status: article.status });
    }
  }, [article]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await apiFetch(`/api/kb/${articleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: form.title, content: form.content, status: form.status }),
      });
      setSuccess('Article updated');
      setEditing(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/kb" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          &larr; Back to Knowledge Base
        </Link>
      </div>

      {loadError && <Alert tone="error">Failed to load article: {loadError}</Alert>}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading article…</p>
        ) : !article ? (
          !loadError && <p className="text-sm text-zinc-500">Article not found.</p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{article.title}</h1>
                <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                  <Badge className={ARTICLE_STATUS_COLORS[article.status]}>{article.status}</Badge>
                  <span>{article.views} views</span>
                  <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            {error && (
              <Alert tone="error" className="mt-4">
                {error}
              </Alert>
            )}
            {success && (
              <Alert tone="success" className="mt-4">
                {success}
              </Alert>
            )}

            {editing ? (
              <form onSubmit={handleUpdate} className="mt-6 space-y-4">
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
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Updating…' : 'Update Article'}
                </Button>
              </form>
            ) : (
              <p className="mt-6 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{article.content}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
