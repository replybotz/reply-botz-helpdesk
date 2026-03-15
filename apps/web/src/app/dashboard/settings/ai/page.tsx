'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface ProviderConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface FeatureConfig {
  feature: string;
  primary: ProviderConfig;
  fallbackChain: ProviderConfig[];
}

interface ProvidersResponse {
  providers: string[];
  features: FeatureConfig[];
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google AI',
  openrouter: 'OpenRouter',
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  openai: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  google: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  openrouter: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
};

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Helpdesk Chat',
  ticket: 'Ticket Classification',
  kb_generation: 'KB Article Generation',
  embedding: 'Semantic Search Embeddings',
  moderation: 'Content Moderation',
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  chat: 'AI model used to respond to student and staff conversations',
  ticket: 'Classifies and prioritizes incoming support tickets',
  kb_generation: 'Generates knowledge base articles from resolved tickets',
  embedding: 'Creates vector embeddings for semantic KB search',
  moderation: 'Screens messages for inappropriate content',
};

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${PROVIDER_COLORS[provider] ?? 'bg-gray-100 text-gray-600'}`}>
      {PROVIDER_LABELS[provider] ?? provider}
    </span>
  );
}

function ModelConfig({ config, label }: { config: ProviderConfig; label: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
          <ProviderBadge provider={config.provider} />
        </div>
        <p className="text-sm font-mono font-medium text-gray-900 dark:text-white truncate">{config.model}</p>
        <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
          {config.temperature !== undefined && <span>temp: {config.temperature}</span>}
          {config.maxTokens && <span>max tokens: {config.maxTokens.toLocaleString()}</span>}
        </div>
      </div>
    </div>
  );
}

export default function AiSettingsPage() {
  const { data, isLoading, error } = useQuery<ProvidersResponse>({
    queryKey: ['ai-providers'],
    queryFn: () => apiClient.get('/ai/providers').then((r) => r.data.data),
    retry: 1,
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          AI provider and model configuration for each helpdesk feature. Configure API keys in your environment variables.
        </p>
      </div>

      {/* Configured providers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Configured Providers</h2>
        {isLoading ? (
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Unable to load providers. You may not have admin access.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(data?.providers ?? []).map((p) => (
              <div key={p} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{PROVIDER_LABELS[p] ?? p}</span>
              </div>
            ))}
            {data?.providers.length === 0 && (
              <p className="text-sm text-gray-400 italic">No providers configured. Add API keys to your .env file.</p>
            )}
          </div>
        )}
      </div>

      {/* Feature routing */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Feature Model Routing</h2>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))
        ) : error ? null : (
          (data?.features ?? []).map((feature) => (
            <div key={feature.feature} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {FEATURE_LABELS[feature.feature] ?? feature.feature}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {FEATURE_DESCRIPTIONS[feature.feature] ?? ''}
                </p>
              </div>
              <div className="space-y-2">
                <ModelConfig config={feature.primary} label="Primary" />
                {feature.fallbackChain.map((fb, i) => (
                  <ModelConfig key={i} config={fb} label={`Fallback ${i + 1}`} />
                ))}
                {feature.fallbackChain.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic pl-1">No fallback configured</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Environment variable reference */}
      <div className="mt-8 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Environment Variables</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Configure provider API keys in your <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">apps/api/.env</code> file:
        </p>
        <div className="space-y-1.5">
          {[
            { key: 'ANTHROPIC_API_KEY', provider: 'Anthropic (Claude)' },
            { key: 'OPENAI_API_KEY', provider: 'OpenAI (GPT-4, Embeddings, Moderation)' },
            { key: 'GOOGLE_AI_API_KEY', provider: 'Google AI (Gemini)' },
            { key: 'OPENROUTER_API_KEY', provider: 'OpenRouter (multiple models)' },
          ].map(({ key, provider }) => (
            <div key={key} className="flex items-center gap-3 text-xs">
              <code className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded font-mono text-gray-800 dark:text-gray-200 w-52 shrink-0">
                {key}
              </code>
              <span className="text-gray-500 dark:text-gray-400">{provider}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content moderation note */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Content Moderation</h3>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          All student messages are automatically screened for inappropriate content using the moderation model before processing.
          FERPA-sensitive data is never sent to external AI providers — customer PII is decrypted only on server-side, not passed to models.
        </p>
      </div>
    </div>
  );
}
