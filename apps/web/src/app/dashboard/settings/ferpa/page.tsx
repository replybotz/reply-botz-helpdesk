'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface DataRequest {
  id: string;
  requestType: string;
  status: string;
  requesterId: string;
  targetStudentId: string;
  reason?: string;
  requestedAt: string;
  resolvedAt?: string;
}

type TabId = 'audit' | 'data-requests' | 'info';

const REQUEST_TYPE_LABELS: Record<string, string> = {
  ACCESS: 'Access Request',
  EXPORT: 'Data Export',
  DELETION: 'Deletion Request',
  CORRECTION: 'Data Correction',
};

const REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  DENIED: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  COMPLETED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
};

export default function FerpaSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('audit');

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');

  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestType, setNewRequestType] = useState('ACCESS');
  const [newStudentId, setNewStudentId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (resourceTypeFilter) params.resourceType = resourceTypeFilter;
      const res = await apiClient.get('/ferpa/audit-log', { params });
      setAuditLog(res.data.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setAuditError(e.response?.data?.message ?? 'Failed to load audit log. Admin access required.');
    } finally {
      setAuditLoading(false);
    }
  }, [resourceTypeFilter]);

  const fetchDataRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const res = await apiClient.get('/ferpa/data-requests');
      setDataRequests(res.data.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setRequestsError(e.response?.data?.message ?? 'Failed to load data requests.');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLog();
    if (activeTab === 'data-requests') fetchDataRequests();
  }, [activeTab, fetchAuditLog, fetchDataRequests]);

  const handleSubmitRequest = async () => {
    if (!newStudentId.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.post('/ferpa/data-requests', {
        requestType: newRequestType,
        targetStudentId: newStudentId.trim(),
        reason: newReason.trim() || undefined,
      });
      setShowNewRequestModal(false);
      setNewStudentId(''); setNewReason(''); setNewRequestType('ACCESS');
      fetchDataRequests();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e.response?.data?.message ?? 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'audit', label: 'Audit Log' },
    { id: 'data-requests', label: 'Data Requests' },
    { id: 'info', label: 'FERPA Info' },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FERPA & Privacy</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Manage student privacy compliance, audit logs, and data access requests under FERPA.
        </p>
      </div>

      {/* FERPA status badge */}
      <div className="mb-6 flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">FERPA Compliance Active</p>
          <p className="text-xs text-green-600 dark:text-green-400">Student PII is encrypted at rest. All data access is logged. AI models never receive unencrypted student data.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <select value={resourceTypeFilter} onChange={(e) => setResourceTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">All Resource Types</option>
              <option value="customer">Customer</option>
              <option value="ticket">Ticket</option>
              <option value="conversation">Conversation</option>
              <option value="message">Message</option>
              <option value="user">User</option>
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500">Showing last 100 entries</p>
          </div>

          {auditError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">{auditError}</div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {auditLoading ? (
              <div className="p-8 text-center text-gray-400 animate-pulse">Loading audit log...</div>
            ) : auditLog.length === 0 ? (
              <p className="p-8 text-center text-gray-400 dark:text-gray-500 italic">No audit entries found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Timestamp</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Action</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Resource Type</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Resource ID</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white text-xs">{entry.action}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 text-xs">{entry.resourceType}</td>
                        <td className="px-5 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs">{entry.resourceId.slice(0, 12)}...</td>
                        <td className="px-5 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs">
                          {entry.actorId ? entry.actorId.slice(0, 8) + '...' : 'system'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Requests Tab */}
      {activeTab === 'data-requests' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={() => setShowNewRequestModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
              + New Request
            </button>
          </div>

          {requestsError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">{requestsError}</div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {requestsLoading ? (
              <div className="p-8 text-center text-gray-400 animate-pulse">Loading data requests...</div>
            ) : dataRequests.length === 0 ? (
              <p className="p-8 text-center text-gray-400 dark:text-gray-500 italic">No data requests found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Type</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Student ID</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Reason</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Requested</th>
                      <th className="px-5 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Resolved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {dataRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white text-xs">
                          {REQUEST_TYPE_LABELS[req.requestType] ?? req.requestType}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs">{req.targetStudentId.slice(0, 12)}...</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">{req.reason ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{new Date(req.requestedAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {req.resolvedAt ? new Date(req.resolvedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* New Request Modal */}
          {showNewRequestModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New FERPA Data Request</h2>
                {submitError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">{submitError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Request Type</label>
                    <select value={newRequestType} onChange={(e) => setNewRequestType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="ACCESS">Access Request</option>
                      <option value="EXPORT">Data Export</option>
                      <option value="DELETION">Deletion Request</option>
                      <option value="CORRECTION">Data Correction</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student ID <span className="text-red-500">*</span></label>
                    <input type="text" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)}
                      placeholder="Student UUID or LMS user ID"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea value={newReason} onChange={(e) => setNewReason(e.target.value)} rows={3}
                      placeholder="Provide justification for this request..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                  </div>
                </div>
                <div className="mt-6 flex gap-3 justify-end">
                  <button onClick={() => { setShowNewRequestModal(false); setSubmitError(null); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleSubmitRequest} disabled={isSubmitting || !newStudentId.trim()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FERPA Info Tab */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {[
            {
              title: 'What is FERPA?',
              content: 'The Family Educational Rights and Privacy Act (FERPA) is a federal law that protects the privacy of student education records. It applies to all schools that receive funds under an applicable program of the U.S. Department of Education.',
            },
            {
              title: 'How Reply Botz HD protects student data',
              content: 'All student personally identifiable information (PII) — including names, emails, and contact details — is encrypted at rest using AES-256 encryption. Access to student data is logged in the FERPA audit trail. AI models are never provided with unencrypted student PII.',
            },
            {
              title: 'Student rights under FERPA',
              content: 'Students have the right to inspect their education records, request corrections to inaccurate records, and consent to disclosure of their records. Schools must respond to valid requests within 45 days.',
            },
            {
              title: 'Directory information',
              content: 'Directory information (name, email, enrollment status) may be disclosed without consent unless a student has exercised their right to restrict disclosure. Contact your institution\'s FERPA coordinator for specific policies.',
            },
          ].map((section) => (
            <div key={section.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{section.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
