'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [tenantName, setTenantName] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'ai', label: 'AI Configuration' },
    { id: 'security', label: 'Security' },
  ];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const updates: Record<string, string | null> = {};
      if (tenantName) updates.name = tenantName;
      if (domain) updates.domain = domain;

      const res = await fetch('/api/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }
      setSuccess('Settings saved');
    } catch {
      setError('Network error');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Manage your organization settings, integrations, and AI configuration.
      </p>

      <div className="mt-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
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
          <form onSubmit={handleSave} className="max-w-lg space-y-6">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Organization</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Your Organization"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Custom Domain
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="support.example.com"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}

        {activeTab === 'integrations' && (
          <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
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
          <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">AI Configuration</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Configure AI providers and models for automated responses and suggestions.
            </p>
            <div className="mt-4 space-y-3">
              {['OpenAI', 'Anthropic', 'Google AI'].map((provider) => (
                <div
                  key={provider}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{provider}</span>
                  <span className="text-xs text-zinc-500">Not configured</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-lg space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Two-Factor Authentication</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Add an extra layer of security with TOTP-based two-factor authentication.
              </p>
              <button className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
                Setup MFA
              </button>
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
