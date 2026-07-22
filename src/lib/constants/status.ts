/** Single source of truth for enum display labels and badge colors. */

export const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  WAITING_ON_CUSTOMER: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  WAITING_ON_THIRD_PARTY: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOSED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
};

export const TICKET_STATUS_OPTIONS = Object.keys(TICKET_STATUS_COLORS);

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
};

export const PRIORITY_OPTIONS = Object.keys(PRIORITY_COLORS);

export const CONVERSATION_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ASSIGNED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PENDING: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOSED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
};

export const ARTICLE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
};

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TENANT_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  SUPERVISOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  AGENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CUSTOMER: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
};

export const USER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  INACTIVE: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

export const CHANNEL_LABELS: Record<string, string> = {
  LIVE_CHAT: 'Live Chat',
  EMAIL: 'Email',
  VOICE: 'Voice',
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
  TELEGRAM: 'Telegram',
  SLACK: 'Slack',
  TWITTER: 'Twitter',
  API: 'API',
};

export const MESSAGE_ROLE_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-50 dark:bg-blue-950',
  AGENT: 'bg-white dark:bg-zinc-900',
  AI: 'bg-purple-50 dark:bg-purple-950',
  SYSTEM: 'bg-zinc-50 dark:bg-zinc-950',
};

/** "WAITING_ON_CUSTOMER" -> "WAITING ON CUSTOMER" */
export function formatEnum(value: string): string {
  return value.replace(/_/g, ' ');
}
