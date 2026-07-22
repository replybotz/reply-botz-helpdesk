export const Permission = {
  // Tenant management
  TENANT_READ: 'tenant:read',
  TENANT_UPDATE: 'tenant:update',
  TENANT_DELETE: 'tenant:delete',
  TENANT_MANAGE_ALL: 'tenant:manage_all',

  // User management
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE_ROLES: 'user:manage_roles',

  // Conversations
  CONVERSATION_READ: 'conversation:read',
  CONVERSATION_READ_OWN: 'conversation:read_own',
  CONVERSATION_CREATE: 'conversation:create',
  CONVERSATION_ASSIGN: 'conversation:assign',
  CONVERSATION_CLOSE: 'conversation:close',

  // Tickets
  TICKET_READ: 'ticket:read',
  TICKET_READ_OWN: 'ticket:read_own',
  TICKET_CREATE: 'ticket:create',
  TICKET_UPDATE: 'ticket:update',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_DELETE: 'ticket:delete',

  // Knowledge Base
  KB_READ: 'kb:read',
  KB_CREATE: 'kb:create',
  KB_UPDATE: 'kb:update',
  KB_DELETE: 'kb:delete',
  KB_PUBLISH: 'kb:publish',

  // AI Configuration
  AI_CONFIG_READ: 'ai_config:read',
  AI_CONFIG_MANAGE: 'ai_config:manage',

  // Integrations
  INTEGRATION_READ: 'integration:read',
  INTEGRATION_MANAGE: 'integration:manage',

  // Analytics
  ANALYTICS_READ: 'analytics:read',

  // Audit Logs
  AUDIT_LOG_READ: 'audit_log:read',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];
