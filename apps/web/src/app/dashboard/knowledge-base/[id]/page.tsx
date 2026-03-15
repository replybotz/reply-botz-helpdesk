'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

type ArticleStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

interface KbArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  status: ArticleStatus;
  source: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  tags: string[];
  targetRole?: string;
  lmsPlatform?: string;
  category?: { id: string; name: string };
  author?: { id: string; name: string };
  reviewedBy?: { id: string; name: string };
  publishedAt?: string;
  updatedAt: string;
  createdAt: string;
}

const STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  REVIEW: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  ARCHIVED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export default function KbArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [article, setArticle] = useState<KbArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const loadArticle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/knowledge-base/${id}`);
      const a: KbArticle = res.data.data;
      setArticle(a);
      setEditTitle(a.title);
      setEditContent(a.content);
      setEditSummary(a.summary ?? '');
      setEditTags(a.tags.join(', '));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to load article.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadArticle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await apiClient.patch(`/knowledge-base/${id}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
        summary: editSummary.trim() || undefined,
        tags,
      });
      setArticle(res.data.data);
      setIsEditing(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSaveError(e.response?.data?.message ?? 'Failed to save article.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await apiClient.post(`/knowledge-base/${id}/publish`);
      setArticle(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Failed to publish article.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const res = await apiClient.post(`/knowledge-base/${id}/archive`);
      setArticle(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Failed to archive article.');
    } finally {
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error ?? 'Article not found.'}
          <button onClick={() => router.back()} className="ml-3 underline font-medium">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/knowledge-base" className="hover:text-blue-600 dark:hover:text-blue-400">Knowledge Base</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium truncate max-w-xs">{article.title}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[article.status]}`}>
              {article.status.charAt(0) + article.status.slice(1).toLowerCase()}
            </span>
            {article.source && article.source !== 'MANUAL' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                AI Generated
              </span>
            )}
            <span className="text-xs text-gray-400">{article.viewCount} views</span>
            {(article.helpfulCount + article.notHelpfulCount) > 0 && (
              <span className="text-xs text-gray-400">
                {Math.round((article.helpfulCount / (article.helpfulCount + article.notHelpfulCount)) * 100)}% helpful
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Edit
            </button>
          )}
          {article.status === 'DRAFT' && (
            <button onClick={handlePublish} disabled={isPublishing}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-lg transition-colors">
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
          {article.status === 'PUBLISHED' && (
            <button onClick={handleArchive} disabled={isArchiving}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              {isArchiving ? 'Archiving...' : 'Archive'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main editor/viewer */}
        <div className="lg:col-span-3">
          {isEditing ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {saveError}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary <span className="font-normal text-gray-400">(optional)</span></label>
                  <textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} rows={2}
                    placeholder="Brief summary shown in search results..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={20}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-y font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags <span className="font-normal text-gray-400">(comma-separated)</span></label>
                  <input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button onClick={() => { setIsEditing(false); setSaveError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving || !editTitle.trim() || !editContent.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{article.title}</h1>
              {article.summary && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 italic">{article.summary}</p>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                  {article.content}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Details</h2>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {article.category && (
                <div className="flex justify-between">
                  <span>Category</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{article.category.name}</span>
                </div>
              )}
              {article.author && (
                <div className="flex justify-between">
                  <span>Author</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{article.author.name}</span>
                </div>
              )}
              {article.reviewedBy && (
                <div className="flex justify-between">
                  <span>Reviewed by</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{article.reviewedBy.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Created</span>
                <span>{new Date(article.createdAt).toLocaleDateString()}</span>
              </div>
              {article.publishedAt && (
                <div className="flex justify-between">
                  <span>Published</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {article.tags.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-md">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Feedback</h2>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{article.helpfulCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Helpful</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-red-500 dark:text-red-400">{article.notHelpfulCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Not helpful</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{article.viewCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Views</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
