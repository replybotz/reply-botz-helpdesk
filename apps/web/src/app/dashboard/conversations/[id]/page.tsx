'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

type ConversationStatus = 'ACTIVE' | 'WAITING' | 'RESOLVED' | 'CLOSED';
type ConversationChannel = 'EMAIL' | 'CHAT' | 'WHATSAPP' | 'SLACK' | 'DISCORD' | 'API';
type MessageSenderType = 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';

interface Message {
  id: string;
  content: string;
  senderType: MessageSenderType;
  sender?: { id: string; name: string };
  contentType: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  customer?: { id: string; name?: string; email?: string };
  assignedAgent?: { id: string; name: string; email: string };
  messages?: Message[];
  lmsUserId?: string;
  lmsPlatform?: string;
  lmsCourseId?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS: { value: ConversationStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const STATUS_COLORS: Record<ConversationStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  WAITING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  RESOLVED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  CLOSED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const SENDER_STYLES: Record<MessageSenderType, string> = {
  CUSTOMER: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 self-start',
  AGENT: 'bg-blue-600 text-white self-end',
  AI: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 self-start',
  SYSTEM: 'bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-300 self-center text-xs italic',
};

const SENDER_LABEL: Record<MessageSenderType, string> = {
  CUSTOMER: 'Customer',
  AGENT: 'Agent',
  AI: 'AI',
  SYSTEM: 'System',
};

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editStatus, setEditStatus] = useState<ConversationStatus>('ACTIVE');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadConversation = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/conversations/${id}`);
      const c: Conversation = res.data.data;
      setConversation(c);
      setEditStatus(c.status);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to load conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSaveStatus = async () => {
    if (!conversation) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await apiClient.patch(`/conversations/${id}`, { status: editStatus });
      setConversation(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSaveError(e.response?.data?.message ?? 'Failed to update status.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      await apiClient.post(`/conversations/${id}/messages`, {
        content: messageContent.trim(),
        senderType: 'AGENT',
      });
      setMessageContent('');
      await loadConversation();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSendError(e.response?.data?.message ?? 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error ?? 'Conversation not found.'}
          <button onClick={() => router.back()} className="ml-3 underline font-medium">Go back</button>
        </div>
      </div>
    );
  }

  const hasStatusChange = editStatus !== conversation.status;

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/conversations" className="hover:text-blue-600 dark:hover:text-blue-400">
          Conversations
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-mono text-xs">{conversation.id.slice(0, 8)}...</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {conversation.channel} Conversation
        </h1>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[conversation.status]}`}>
            {conversation.status.charAt(0) + conversation.status.slice(1).toLowerCase()}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Started {new Date(conversation.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col" style={{ minHeight: '480px' }}>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3" style={{ maxHeight: '480px' }}>
              {!conversation.messages || conversation.messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 italic py-12">
                  No messages yet
                </p>
              ) : (
                conversation.messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.senderType === 'AGENT' ? 'self-end items-end' : 'self-start items-start'}`}>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mb-1 px-1">
                      {SENDER_LABEL[msg.senderType]}
                      {msg.sender?.name && ` · ${msg.sender.name}`}
                    </span>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${SENDER_STYLES[msg.senderType]}`}>
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              {sendError && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">{sendError}</p>
              )}
              <div className="flex gap-2">
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                  disabled={conversation.status === 'CLOSED'}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !messageContent.trim() || conversation.status === 'CLOSED'}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors self-end"
                >
                  {isSending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Status</h2>
            {saveError && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">{saveError}</p>
            )}
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as ConversationStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none mb-3"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {hasStatusChange && (
              <button
                onClick={handleSaveStatus}
                disabled={isSaving}
                className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
              >
                {isSaving ? 'Saving...' : 'Update Status'}
              </button>
            )}
          </div>

          {/* Customer */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Customer</h2>
            {conversation.customer ? (
              <div className="text-sm space-y-1">
                {conversation.customer.name && (
                  <p className="text-gray-900 dark:text-white font-medium">{conversation.customer.name}</p>
                )}
                {conversation.customer.email && (
                  <p className="text-gray-500 dark:text-gray-400">{conversation.customer.email}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">Anonymous</p>
            )}
          </div>

          {/* Agent */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Assigned Agent</h2>
            {conversation.assignedAgent ? (
              <div className="text-sm space-y-1">
                <p className="text-gray-900 dark:text-white font-medium">{conversation.assignedAgent.name}</p>
                <p className="text-gray-500 dark:text-gray-400">{conversation.assignedAgent.email}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">Unassigned</p>
            )}
          </div>

          {/* LMS context */}
          {(conversation.lmsUserId || conversation.lmsPlatform || conversation.lmsCourseId) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">LMS Context</h2>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                {conversation.lmsPlatform && <p>Platform: <span className="font-medium text-gray-800 dark:text-gray-200">{conversation.lmsPlatform}</span></p>}
                {conversation.lmsCourseId && <p>Course: <span className="font-medium text-gray-800 dark:text-gray-200">{conversation.lmsCourseId}</span></p>}
                {conversation.lmsUserId && <p>LMS User: <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{conversation.lmsUserId}</span></p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
