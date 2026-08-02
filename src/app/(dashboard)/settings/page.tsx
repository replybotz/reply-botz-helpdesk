'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { AiProviderSettings } from '@/components/settings/ai-providers';

const inputClasses =
  'mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50';

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'ai', label: 'AI Configuration' },
  { id: 'security', label: 'Security' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [tenantName, setTenantName] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // MFA setup state
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const updates: Record<string, string | null> = {};
      if (tenantName) updates.name = tenantName;
      if (domain) updates.domain = domain;

      await apiFetch('/api/tenants', { method: 'PATCH', body: JSON.stringify(updates) });
      setSuccess('Settings saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    }
  }

  async function startMfaSetup() {
    setMfaError('');
    setMfaSuccess('');
    try {
      const setup = await apiFetch<{ secret: string; uri: string }>('/api/auth/mfa/setup', {
        method: 'POST',
      });
      setMfaSetup(setup);
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : 'Network error');
    }
  }

  async function verifyMfaSetup(e: React.FormEvent) {
    e.preventDefault();
    setMfaError('');
    try {
      await apiFetch('/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ token: mfaCode }),
      });
      setMfaSetup(null);
      setMfaCode('');
      setMfaSuccess('Two-factor authentication is now enabled.');
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : 'Network error');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Manage your organization settings, integrations, and AI configuration.
      </p>

      <div role="tablist" aria-label="Settings sections" className="mt-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'general' && (
          <form
            id="panel-general"
            role="tabpanel"
            aria-labelledby="tab-general"
            onSubmit={handleSave}
            className="max-w-lg space-y-6"
          >
            {error && <Alert tone="error">{error}</Alert>}
            {success && <Alert tone="success">{success}</Alert>}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Organization</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="org-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Organization Name
                  </label>
                  <input
                    id="org-name"
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Your Organization"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="org-domain" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Custom Domain
                  </label>
                  <input
                    id="org-domain"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="support.example.com"
                    className={inputClasses}
                  />
                </div>
              </div>
              <Button type="submit" className="mt-4">
                Save Changes
              </Button>
            </div>
          </form>
        )}

        {activeTab === 'integrations' && (
          <div
            id="panel-integrations"
            role="tabpanel"
            aria-labelledby="tab-integrations"
            className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Integrations</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Connect external services like email (SMTP), Slack, WhatsApp, and more.
            </p>
            <div className="mt-4 space-y-3">
              {['Email (SMTP)', 'Slack', 'WhatsApp', 'Facebook Messenger', 'Telegram'].map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{name}</span>
                  <span className="text-xs text-zinc-500">Not configured</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div id="panel-ai" role="tabpanel" aria-labelledby="tab-ai">
            <AiProviderSettings />
          </div>
        )}

        {activeTab === 'security' && (
          <div
            id="panel-security"
            role="tabpanel"
            aria-labelledby="tab-security"
            className="max-w-lg space-y-4"
          >
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Two-Factor Authentication</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Add an extra layer of security with TOTP-based two-factor authentication.
              </p>

              {mfaError && (
                <Alert tone="error" className="mt-4">
                  {mfaError}
                </Alert>
              )}
              {mfaSuccess && (
                <Alert tone="success" className="mt-4">
                  {mfaSuccess}
                </Alert>
              )}

              {!mfaSetup ? (
                <Button variant="outline" className="mt-4" onClick={startMfaSetup}>
                  Setup MFA
                </Button>
              ) : (
                <form onSubmit={verifyMfaSetup} className="mt-4 space-y-4">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Add this secret to your authenticator app, then enter the 6-digit code to confirm.
                  </p>
                  <code className="block break-all rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800">
                    {mfaSetup.secret}
                  </code>
                  <div>
                    <label htmlFor="mfa-code" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Authentication Code
                    </label>
                    <input
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      required
                      className={inputClasses}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={mfaCode.length !== 6}>
                      Verify &amp; Enable
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setMfaSetup(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Active Sessions</h3>
              <p className="mt-2 text-sm text-zinc-500">
                View and manage your active login sessions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
