'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

type ArticleStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

interface KbCategory {
  id: string;
  name: string;
}

interface KbArticle {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  source: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  tags: string[];
  category?: { id: string; name: string };
  author?: { id: string; name: string };
  publishedAt?: string;
  updatedAt: string;
  createdAt: string;
}

interface PaginatedResponse {
  data: KbArticle[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  REVIEW: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  ARCHIVED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [generatingFromTicket, setGeneratingFromTicket] = useState(false);
  const [ticketIdInput, setTicketIdInput] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (search) params.search = search;
      const res = await apiClient.get('/knowledge-base', { params });
      const result: PaginatedResponse = res.data.data;
      setArticles(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to load articles.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, categoryFilter, search]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    apiClient.get('/knowledge-base/categories')
      .then((r) => setCategories(r.data.data ?? []))
      .catch(() => {});
  }, []);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean);
      await apiClient.post('/knowledge-base', {
        title: newTitle.trim(),
        content: newContent.trim(),
        categoryId: newCategoryId || undefined,
        tags,
      });
      setShowNewModal(false);
      setNewTitle(''); setNewContent(''); setNewCategoryId(''); setNewTags('');
      fetchArticles();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setCreateError(e.response?.data?.message ?? 'Failed to create article.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateFromTicket = async () => {
    if (!ticketIdInput.trim()) return;
    setGeneratingFromTicket(true);
    try {
      await apiClient.post('/knowledge-base/generate-from-ticket', { ticketId: ticketIdInput.trim() });
      setShowGenerateModal(false);
      setTicketIdInput('');
      fetchArticles();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Failed to generate article from ticket.');
    } finally {
      setGeneratingFromTicket(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {total > 0 ? `${total.toLocaleString()} articles` : 'Manage help articles and documentation'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            AI from Ticket
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + New Article
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="REVIEW">In Review</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <div className="flex gap-2 flex-1 min-w-48">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search articles..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
          <button onClick={fetchArticles} className="ml-3 underline font-medium">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Title</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Category</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Views</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Helpful</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                    No articles found
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/knowledge-base/${article.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {article.title}
                      </Link>
                      {article.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {article.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[article.status]}`}>
                        {article.status.charAt(0) + article.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {article.category?.name ?? <span className="italic text-gray-300 dark:text-gray-600">Uncategorized</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{article.viewCount}</td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {article.helpfulCount > 0 || article.notHelpfulCount > 0 ? (
                        <span className="text-green-600 dark:text-green-400">{article.helpfulCount}</span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(article.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
                Previous
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Article Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Article</h2>
              {createError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {createError}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span className="text-red-500">*</span></label>
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Article title..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={8}
                    placeholder="Write article content (Markdown supported)..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-y font-mono" />
                </div>
                {categories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                  <input type="text" value={newTags} onChange={(e) => setNewTags(e.target.value)}
                    placeholder="e.g. canvas, assignment, student"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button onClick={() => { setShowNewModal(false); setCreateError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={isCreating || !newTitle.trim() || !newContent.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
                  {isCreating ? 'Creating...' : 'Create Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate from Ticket Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generate Article from Ticket</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">AI will generate a knowledge base article from the resolved ticket.</p>
            <input type="text" value={ticketIdInput} onChange={(e) => setTicketIdInput(e.target.value)}
              placeholder="Ticket ID (UUID)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleGenerateFromTicket} disabled={generatingFromTicket || !ticketIdInput.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-lg transition-colors">
                {generatingFromTicket ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
