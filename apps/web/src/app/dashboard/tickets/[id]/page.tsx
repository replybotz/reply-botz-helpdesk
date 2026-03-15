'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_THIRD_PARTY' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface TicketNote {
  id: string;
  content: string;
  isInternal: boolean;
  author?: { id: string; name: string; email: string };
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer?: { id: string; name?: string; email?: string };
  assignedAgent?: { id: string; name: string; email: string };
  category?: { id: string; name: string };
  notes?: TicketNote[];
  aiSummary?: string;
  aiClassification?: unknown;
  lmsUserId?: string;
  lmsPlatform?: string;
  lmsCourseId?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_FOR_CUSTOMER', label: 'Waiting for Customer' },
  { value: 'WAITING_FOR_THIRD_PARTY', label: 'Waiting for Third Party' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  IN_PROGRESS: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  WAITING_FOR_CUSTOMER: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  WAITING_FOR_THIRD_PARTY: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  CLOSED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-500',
  NORMAL: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  URGENT: 'bg-red-100 text-red-600',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editStatus, setEditStatus] = useState<TicketStatus>('OPEN');
  const [editPriority, setEditPriority] = useState<TicketPriority>('NORMAL');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [noteContent, setNoteContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    apiClient.get(`/tickets/${id}`)
      .then((res) => {
        const t: Ticket = res.data.data;
        setTicket(t);
        setEditStatus(t.status);
        setEditPriority(t.priority);
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message ?? 'Failed to load ticket.');
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!ticket) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await apiClient.patch(`/tickets/${id}`, {
        status: editStatus,
        priority: editPriority,
      });
      setTicket(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSaveError(e.response?.data?.message ?? 'Failed to update ticket.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setIsAddingNote(true);
    setNoteError(null);
    try {
      await apiClient.post(`/tickets/${id}/notes`, {
        content: noteContent.trim(),
        isInternal,
      });
      // Refresh ticket to get new notes
      const res = await apiClient.get(`/tickets/${id}`);
      setTicket(res.data.data);
      setNoteContent('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setNoteError(e.response?.data?.message ?? 'Failed to add note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error ?? 'Ticket not found.'}
          <button onClick={() => router.back()} className="ml-3 underline font-medium">Go back</button>
        </div>
      </div>
    );
  }

  const hasChanges = editStatus !== ticket.status || editPriority !== ticket.priority;

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/tickets" className="hover:text-blue-600 dark:hover:text-blue-400">
          Tickets
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">#{ticket.ticketNumber}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{ticket.subject}</h1>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
            {ticket.status.replace(/_/g, ' ')}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
            {ticket.priority}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Created {new Date(ticket.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Description</h2>
            {ticket.description ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.description}</p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No description provided.</p>
            )}
          </div>

          {/* AI Summary */}
          {ticket.aiSummary && (
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
              <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">AI Summary</h2>
              <p className="text-sm text-blue-800 dark:text-blue-200">{ticket.aiSummary}</p>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Notes</h2>

            {ticket.notes && ticket.notes.length > 0 ? (
              <div className="space-y-4 mb-6">
                {ticket.notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-4 rounded-lg border text-sm ${
                      note.isInternal
                        ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {note.author?.name ?? 'System'}
                        {note.isInternal && (
                          <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 font-normal">Internal</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic mb-4">No notes yet.</p>
            )}

            {/* Add note form */}
            {noteError && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {noteError}
              </div>
            )}
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="Add a note..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-3"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Internal note
              </label>
              <button
                onClick={handleAddNote}
                disabled={isAddingNote || !noteContent.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
              >
                {isAddingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Update status/priority */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Properties</h2>

            {saveError && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
                {saveError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TicketStatus)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TicketPriority)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {hasChanges && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>

          {/* Customer info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Customer</h2>
            {ticket.customer ? (
              <div className="text-sm space-y-1">
                {ticket.customer.name && (
                  <p className="text-gray-900 dark:text-white font-medium">{ticket.customer.name}</p>
                )}
                {ticket.customer.email && (
                  <p className="text-gray-500 dark:text-gray-400">{ticket.customer.email}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No customer linked</p>
            )}
          </div>

          {/* Assigned agent */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Assigned Agent</h2>
            {ticket.assignedAgent ? (
              <div className="text-sm space-y-1">
                <p className="text-gray-900 dark:text-white font-medium">{ticket.assignedAgent.name}</p>
                <p className="text-gray-500 dark:text-gray-400">{ticket.assignedAgent.email}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">Unassigned</p>
            )}
          </div>

          {/* LMS context */}
          {(ticket.lmsUserId || ticket.lmsPlatform || ticket.lmsCourseId) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">LMS Context</h2>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                {ticket.lmsPlatform && <p>Platform: <span className="font-medium text-gray-800 dark:text-gray-200">{ticket.lmsPlatform}</span></p>}
                {ticket.lmsCourseId && <p>Course: <span className="font-medium text-gray-800 dark:text-gray-200">{ticket.lmsCourseId}</span></p>}
                {ticket.lmsUserId && <p>LMS User: <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{ticket.lmsUserId}</span></p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
