'use client';

import { useMemo, useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

interface ProviderDefinition {
  id: string;
  label: string;
  kind: string;
  defaultModel: string;
  baseUrl?: string;
  requiresApiKey: boolean;
  requiresBaseUrl?: boolean;
  supportsJsonSchema: boolean;
  notes?: string;
}

interface AiConfig {
  id: string;
  provider: string;
  model: string;
  isActive: boolean;
  createdAt: string;
}

const inputClasses =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50';

export function AiProviderSettings() {
  const { data: catalog } = useApi<{ providers: ProviderDefinition[] }>('/api/ai-providers');
  const { data: configData, loading, error: loadError, reload } =
    useApi<{ configs: AiConfig[] }>('/api/ai-config');

  const providers = useMemo(() => catalog?.providers ?? [], [catalog]);
  const configs = configData?.configs ?? [];

  const [providerId, setProviderId] = useState('anthropic');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = providers.find((provider) => provider.id === providerId);
  // The active configuration is the newest one; the API resolves it the same way.
  const activeId = configs.find((config) => config.isActive)?.id;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await apiFetch('/api/ai-config', {
        method: 'POST',
        body: JSON.stringify({
          provider: providerId,
          model: model.trim() || undefined,
          apiKey: apiKey || undefined,
          settings: baseUrl.trim() ? { baseUrl: baseUrl.trim() } : undefined,
        }),
      });
      setApiKey('');
      setModel('');
      setBaseUrl('');
      setSuccess('AI provider saved. New jobs will use it.');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">AI provider</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Bring your own key. Credentials are encrypted before storage and never returned by the API.
        </p>

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

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label htmlFor="ai-provider" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Provider
            </label>
            <select
              id="ai-provider"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className={inputClasses}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
            {selected?.notes && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{selected.notes}</p>
            )}
          </div>

          <div>
            <label htmlFor="ai-model" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Model
            </label>
            <input
              id="ai-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={selected?.defaultModel || 'Model name'}
              className={inputClasses}
            />
            {selected?.defaultModel && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Leave blank to use {selected.defaultModel}.
              </p>
            )}
          </div>

          {selected?.requiresApiKey !== false && (
            <div>
              <label htmlFor="ai-key" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                API key
              </label>
              <input
                id="ai-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                className={inputClasses}
                required={selected?.requiresApiKey}
              />
            </div>
          )}

          {(selected?.requiresBaseUrl || selected?.baseUrl) && (
            <div>
              <label htmlFor="ai-base-url" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Base URL {selected?.requiresBaseUrl ? '' : '(optional)'}
              </label>
              <input
                id="ai-base-url"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={selected?.baseUrl || 'https://your-endpoint/v1'}
                className={inputClasses}
                required={selected?.requiresBaseUrl}
              />
            </div>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save provider'}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Configured providers</h3>

        {loadError && (
          <Alert tone="error" className="mt-4">
            {loadError}
          </Alert>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No provider configured yet. AI drafting and triage stay disabled until one is added.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {configs.map((config) => {
              const definition = providers.find((provider) => provider.id === config.provider);
              return (
                <li key={config.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {definition?.label ?? config.provider}
                    </p>
                    <p className="text-xs text-zinc-500">{config.model}</p>
                  </div>
                  {config.id === activeId ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Active
                    </Badge>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      Added {new Date(config.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
