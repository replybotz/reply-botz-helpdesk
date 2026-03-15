'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

type Period = '7d' | '30d' | '90d';

interface DashboardStats {
  conversations: { total: number; active: number; resolved: number; today: number };
  tickets: {
    total: number; open: number; inProgress: number; resolved: number; closed: number; today: number;
    byPriority: { low: number; normal: number; high: number; urgent: number };
  };
  customers: { total: number; newThisMonth: number };
  kbArticles: { total: number; published: number; draft: number };
  lmsIntegrations: { total: number; enabled: number };
  users: { total: number; active: number };
  aiUsage: { messagesProcessed: number };
}

interface ConversationMetrics {
  period: string;
  totalCreated: number;
  totalResolved: number;
  resolutionRate: number;
  byChannel: Array<{ channel: string; count: number }>;
  trend: Array<{ date: string; created: number; resolved: number }>;
}

interface TicketMetrics {
  period: string;
  totalCreated: number;
  totalResolved: number;
  resolutionRate: number;
  avgResolutionMs: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  trend: Array<{ date: string; created: number; resolved: number }>;
}

interface AgentPerformance {
  agents: Array<{
    id: string; name: string; email: string;
    assignedTickets: number; resolvedTickets: number;
    assignedConversations: number;
  }>;
}

function StatCard({ label, value, sub, accent = false }: {
  label: string; value: number | string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{value}</span>
    </div>
  );
}

function TrendChart({ data, height = 80 }: { data: Array<{ date: string; created: number; resolved: number }>; height?: number }) {
  if (!data?.length) return <p className="text-xs text-gray-400 italic">No trend data</p>;
  const maxVal = Math.max(...data.flatMap((d) => [d.created, d.resolved]), 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div
            className="w-full bg-blue-400 dark:bg-blue-500 rounded-sm opacity-80"
            style={{ height: `${(d.created / maxVal) * (height - 16)}px` }}
            title={`Created: ${d.created}`}
          />
          <div
            className="w-full bg-green-400 dark:bg-green-500 rounded-sm opacity-80"
            style={{ height: `${(d.resolved / maxVal) * (height - 16)}px`, marginTop: 'auto' }}
            title={`Resolved: ${d.resolved}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['analytics-dashboard'],
    queryFn: () => apiClient.get('/analytics/dashboard').then((r) => r.data.data),
  });

  const { data: convMetrics, isLoading: convLoading } = useQuery<ConversationMetrics>({
    queryKey: ['analytics-conversations', period],
    queryFn: () => apiClient.get(`/analytics/conversations?period=${period}`).then((r) => r.data.data),
  });

  const { data: ticketMetrics, isLoading: ticketLoading } = useQuery<TicketMetrics>({
    queryKey: ['analytics-tickets', period],
    queryFn: () => apiClient.get(`/analytics/tickets?period=${period}`).then((r) => r.data.data),
  });

  const { data: agentPerf } = useQuery<AgentPerformance>({
    queryKey: ['analytics-agents'],
    queryFn: () => apiClient.get('/analytics/agents/performance').then((r) => r.data.data),
  });

  const isLoading = statsLoading || convLoading || ticketLoading;

  function fmtMs(ms: number) {
    if (!ms) return '—';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Performance overview across all helpdesk activity</p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && stats && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Conversations" value={stats.conversations.total} sub={`${stats.conversations.active} active today`} />
            <StatCard label="Total Tickets" value={stats.tickets.total} sub={`${stats.tickets.open} open`} accent />
            <StatCard label="Customers" value={stats.customers.total} sub={`+${stats.customers.newThisMonth} this month`} />
            <StatCard label="AI Messages (30d)" value={stats.aiUsage.messagesProcessed} sub="automated responses" accent />
          </div>

          {/* Conversations + Tickets row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Conversation metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Conversations — {period}</h2>
              {convMetrics ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{convMetrics.totalCreated}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{convMetrics.totalResolved}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {convMetrics.resolutionRate?.toFixed(0) ?? 0}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Rate</p>
                    </div>
                  </div>
                  {convMetrics.trend?.length > 0 && (
                    <>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Daily trend</p>
                      <TrendChart data={convMetrics.trend} />
                      <div className="flex gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> Created</span>
                        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" /> Resolved</span>
                      </div>
                    </>
                  )}
                  {convMetrics.byChannel?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">By channel</p>
                      <div className="space-y-1.5">
                        {convMetrics.byChannel.map((c) => (
                          <div key={c.channel} className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-gray-600 dark:text-gray-400">{c.channel}</span>
                            <MiniBar value={c.count} max={convMetrics.totalCreated} color="bg-blue-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">No data available</p>
              )}
            </div>

            {/* Ticket metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Tickets — {period}</h2>
              {ticketMetrics ? (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{ticketMetrics.totalCreated}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{ticketMetrics.totalResolved}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {ticketMetrics.resolutionRate?.toFixed(0) ?? 0}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{fmtMs(ticketMetrics.avgResolutionMs)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg. time</p>
                    </div>
                  </div>
                  {ticketMetrics.trend?.length > 0 && (
                    <>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Daily trend</p>
                      <TrendChart data={ticketMetrics.trend} />
                      <div className="flex gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> Created</span>
                        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" /> Resolved</span>
                      </div>
                    </>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {Object.keys(ticketMetrics.byPriority ?? {}).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">By priority</p>
                        <div className="space-y-1.5">
                          {Object.entries(ticketMetrics.byPriority).map(([p, c]) => (
                            <div key={p} className="flex items-center gap-2 text-xs">
                              <span className="w-14 text-gray-600 dark:text-gray-400 capitalize">{p.toLowerCase()}</span>
                              <MiniBar value={c as number} max={ticketMetrics.totalCreated} color={p === 'URGENT' ? 'bg-red-500' : p === 'HIGH' ? 'bg-orange-500' : 'bg-blue-400'} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.keys(ticketMetrics.byStatus ?? {}).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">By status</p>
                        <div className="space-y-1.5">
                          {Object.entries(ticketMetrics.byStatus).map(([s, c]) => (
                            <div key={s} className="flex items-center gap-2 text-xs">
                              <span className="w-14 text-gray-600 dark:text-gray-400 capitalize truncate">{s.replace(/_/g, ' ').toLowerCase()}</span>
                              <MiniBar value={c as number} max={ticketMetrics.totalCreated} color="bg-purple-400" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">No data available</p>
              )}
            </div>
          </div>

          {/* Knowledge Base + System health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* KB stats */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Knowledge Base</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.kbArticles.total}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.kbArticles.published}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Published</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.kbArticles.draft}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Draft</p>
                </div>
              </div>
              {stats.kbArticles.total > 0 && (
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full"
                    style={{ width: `${(stats.kbArticles.published / stats.kbArticles.total) * 100}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {stats.kbArticles.total > 0
                  ? `${Math.round((stats.kbArticles.published / stats.kbArticles.total) * 100)}% published`
                  : 'No articles yet'}
              </p>
            </div>

            {/* System health */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">System Overview</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Active users</span>
                  <span className="font-medium text-gray-900 dark:text-white">{stats.users.active} / {stats.users.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">LMS integrations</span>
                  <span className="font-medium text-gray-900 dark:text-white">{stats.lmsIntegrations.enabled} enabled / {stats.lmsIntegrations.total} total</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Open tickets</span>
                  <span className={`font-medium ${stats.tickets.open > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                    {stats.tickets.open}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Urgent tickets</span>
                  <span className={`font-medium ${stats.tickets.byPriority.urgent > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {stats.tickets.byPriority.urgent}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">New customers this month</span>
                  <span className="font-medium text-gray-900 dark:text-white">{stats.customers.newThisMonth}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent performance */}
          {agentPerf?.agents && agentPerf.agents.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Agent Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-300">Agent</th>
                      <th className="text-right py-2 pr-4 font-semibold text-gray-600 dark:text-gray-300">Assigned Tickets</th>
                      <th className="text-right py-2 pr-4 font-semibold text-gray-600 dark:text-gray-300">Resolved Tickets</th>
                      <th className="text-right py-2 font-semibold text-gray-600 dark:text-gray-300">Conversations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {agentPerf.agents.map((agent) => (
                      <tr key={agent.id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900 dark:text-white">{agent.name}</p>
                          <p className="text-xs text-gray-400">{agent.email}</p>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">{agent.assignedTickets}</td>
                        <td className="py-3 pr-4 text-right text-green-600 dark:text-green-400">{agent.resolvedTickets}</td>
                        <td className="py-3 text-right text-gray-700 dark:text-gray-300">{agent.assignedConversations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
