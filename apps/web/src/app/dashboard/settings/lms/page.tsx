'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface LmsPlatformInfo {
  platform: string;
  name: string;
  capabilities: string[];
  authMethod: string;
}

interface LmsIntegration {
  id: string;
  lmsPlatform: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  webhookEnabled: boolean;
}

const LMS_ICONS: Record<string, string> = {
  google_classroom: '📚',
  canvas: '🎨',
  moodle: '🦅',
  schoology: '🏫',
  blackboard: '⬛',
  talentlms: '💡',
  d2l_brightspace: '☀️',
  cypher_learning: '🔐',
  absorb_lms: '🧠',
  disco: '🪩',
  learndash: '🎓',
};

export default function LmsSettingsPage() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: platforms } = useQuery<LmsPlatformInfo[]>({
    queryKey: ['lms-platforms'],
    queryFn: async () => {
      const response = await apiClient.get('/lms/platforms');
      return response.data.data;
    },
  });

  const { data: integrations } = useQuery<LmsIntegration[]>({
    queryKey: ['lms-integrations'],
    queryFn: async () => {
      const response = await apiClient.get('/lms');
      return response.data.data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await apiClient.post(`/lms/${integrationId}/sync?type=all`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lms-integrations'] });
      setSyncingId(null);
    },
  });

  const connectedPlatforms = new Set(integrations?.map((i) => i.lmsPlatform) ?? []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">LMS Integrations</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Connect your Learning Management Systems to enable AI-powered context-aware support.
        </p>
      </div>

      {/* Connected integrations */}
      {integrations && integrations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connected</h2>
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{LMS_ICONS[integration.lmsPlatform] ?? '🎓'}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">
                      {integration.lmsPlatform.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {integration.lastSyncAt
                        ? `Last synced ${new Date(integration.lastSyncAt).toLocaleDateString()}`
                        : 'Never synced'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                  <button
                    onClick={() => {
                      setSyncingId(integration.id);
                      syncMutation.mutate(integration.id);
                    }}
                    disabled={syncingId === integration.id}
                    className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                  >
                    {syncingId === integration.id ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available platforms */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Platforms ({platforms?.length ?? 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {platforms?.map((platform) => {
            const isConnected = connectedPlatforms.has(platform.platform);
            return (
              <div
                key={platform.platform}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{LMS_ICONS[platform.platform] ?? '🎓'}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{platform.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {platform.authMethod.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  {isConnected && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300 rounded-full">
                      Connected
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {platform.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                    >
                      {cap.replace('_', ' ')}
                    </span>
                  ))}
                </div>

                {!isConnected && (
                  <button className="w-full text-sm py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
