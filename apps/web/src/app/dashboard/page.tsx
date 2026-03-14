'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

interface OrgStats {
  userCount: number;
  integrationCount: number;
  ticketCount: number;
  conversationCount: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: stats, isLoading } = useQuery<OrgStats>({
    queryKey: ['org-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/organizations/current/stats');
      return response.data.data;
    },
  });

  const { data: lmsIntegrations } = useQuery({
    queryKey: ['lms-integrations'],
    queryFn: async () => {
      const response = await apiClient.get('/lms');
      return response.data.data;
    },
  });

  const statCards = [
    { label: 'Total Users', value: stats?.userCount ?? 0, icon: '👥', color: 'bg-blue-500' },
    { label: 'Active Conversations', value: stats?.conversationCount ?? 0, icon: '💬', color: 'bg-green-500' },
    { label: 'Open Tickets', value: stats?.ticketCount ?? 0, icon: '🎫', color: 'bg-orange-500' },
    { label: 'LMS Integrations', value: stats?.integrationCount ?? 0, icon: '🔗', color: 'bg-purple-500' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Here&apos;s what&apos;s happening with your helpdesk today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.color} bg-opacity-10 rounded-xl flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isLoading ? '—' : stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Status + LMS Integrations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* AI Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Gateway Status</h2>
          <div className="space-y-3">
            {[
              { name: 'Anthropic Claude', status: 'active', model: 'claude-sonnet-4-6' },
              { name: 'OpenAI GPT', status: 'active', model: 'gpt-4o' },
              { name: 'Google Gemini', status: 'standby', model: 'gemini-2.0-flash' },
            ].map((provider) => (
              <div key={provider.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${provider.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{provider.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{provider.model}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  provider.status === 'active'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                }`}>
                  {provider.status}
                </span>
              </div>
            ))}
          </div>
          <a
            href="/dashboard/settings/ai"
            className="mt-4 block text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
          >
            Configure AI providers →
          </a>
        </div>

        {/* LMS Integrations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">LMS Integrations</h2>
          {(!lmsIntegrations || lmsIntegrations.length === 0) ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🔗</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">No LMS integrations configured</p>
              <a
                href="/dashboard/settings/lms"
                className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
              >
                Connect your first LMS →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {lmsIntegrations.map((integration: Record<string, string | boolean>) => (
                <div key={integration.id as string} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {(integration.lmsPlatform as string).replace('_', ' ')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Last sync: {integration.lastSyncAt ? new Date(integration.lastSyncAt as string).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FERPA notice */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
        <span className="text-blue-600 dark:text-blue-400 text-xl">🔒</span>
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">FERPA Compliance Active</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            All student data is encrypted with AES-256-GCM. All access is logged immutably.{' '}
            <a href="/dashboard/settings/ferpa" className="underline">View audit log →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
