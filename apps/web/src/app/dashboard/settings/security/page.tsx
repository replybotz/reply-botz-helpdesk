'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
}

interface MfaSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

type MfaStep = 'idle' | 'setup' | 'verify' | 'done' | 'disabling';

export default function SecuritySettingsPage() {
  const { user: authUser } = useAuthStore();

  const { data: me, refetch: refetchMe } = useQuery<CurrentUser>({
    queryKey: ['auth-me'],
    queryFn: () => apiClient.get('/auth/me').then((r) => r.data.data),
  });

  const [mfaStep, setMfaStep] = useState<MfaStep>('idle');
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetup | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const handleStartSetup = async () => {
    setIsWorking(true);
    setMfaError(null);
    try {
      const res = await apiClient.get('/auth/mfa/setup');
      setMfaSetupData(res.data.data);
      setMfaStep('setup');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMfaError(e.response?.data?.message ?? 'Failed to start MFA setup.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleEnableMfa = async () => {
    if (!mfaToken.trim()) return;
    setIsWorking(true);
    setMfaError(null);
    try {
      const res = await apiClient.post('/auth/mfa/enable', { token: mfaToken.trim() });
      const { backupCodes: codes } = res.data.data;
      setBackupCodes(codes ?? []);
      setMfaStep('done');
      setMfaToken('');
      refetchMe();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMfaError(e.response?.data?.message ?? 'Invalid token. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!mfaToken.trim()) return;
    setIsWorking(true);
    setMfaError(null);
    try {
      await apiClient.post('/auth/mfa/disable', { token: mfaToken.trim() });
      setMfaStep('idle');
      setMfaToken('');
      refetchMe();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMfaError(e.response?.data?.message ?? 'Invalid token. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const mfaEnabled = me?.mfaEnabled ?? false;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage your account security settings</p>
      </div>

      {/* Account info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Account</h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-lg font-bold">
            {(me?.name ?? authUser?.name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{me?.name ?? authUser?.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{me?.email ?? authUser?.email}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 capitalize">
              {(me?.role ?? authUser?.role ?? '').toLowerCase().replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* MFA */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Two-Factor Authentication</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Use an authenticator app (Google Authenticator, Authy, etc.) to add an extra layer of security.
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            mfaEnabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${mfaEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            {mfaEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {mfaError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {mfaError}
          </div>
        )}

        {/* Idle — not enabled */}
        {!mfaEnabled && mfaStep === 'idle' && (
          <button onClick={handleStartSetup} disabled={isWorking}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
            {isWorking ? 'Setting up...' : 'Set up 2FA'}
          </button>
        )}

        {/* Setup — show QR code */}
        {mfaStep === 'setup' && mfaSetupData && (
          <div>
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Scan this QR code with your authenticator app, then enter the 6-digit code below.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mfaSetupData.qrCodeDataUrl} alt="MFA QR Code" className="mx-auto w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-600" />
              <details className="mt-3">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Can&apos;t scan? Enter secret manually</summary>
                <code className="block mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
                  {mfaSetupData.secret}
                </code>
              </details>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder="000000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-center text-2xl tracking-widest font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setMfaStep('idle'); setMfaSetupData(null); setMfaError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleEnableMfa} disabled={isWorking || mfaToken.length !== 6}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
                  {isWorking ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Done — show backup codes */}
        {mfaStep === 'done' && backupCodes.length > 0 && (
          <div>
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">2FA enabled successfully!</p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Save these backup codes in a safe place. Each code can only be used once if you lose access to your authenticator app.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {backupCodes.map((code, i) => (
                <code key={i} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200 text-center tracking-widest">
                  {code}
                </code>
              ))}
            </div>
            <button onClick={() => setMfaStep('idle')}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              Done
            </button>
          </div>
        )}

        {/* Enabled — disable option */}
        {mfaEnabled && mfaStep === 'idle' && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Two-factor authentication is active. Your account requires a verification code on every login.
            </p>
            <button onClick={() => { setMfaStep('disabling'); setMfaError(null); }}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors">
              Disable 2FA
            </button>
          </div>
        )}

        {/* Disabling — confirm with token */}
        {mfaStep === 'disabling' && (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Enter your current authenticator code to confirm disabling 2FA.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                placeholder="000000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-center text-2xl tracking-widest font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex gap-3">
                <button onClick={() => { setMfaStep('idle'); setMfaToken(''); setMfaError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleDisableMfa} disabled={isWorking || mfaToken.length !== 6}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition-colors">
                  {isWorking ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
