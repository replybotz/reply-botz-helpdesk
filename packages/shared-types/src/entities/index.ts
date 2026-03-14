import {
  UserRole,
  LmsPlatform,
  ConversationStatus,
  ConversationChannel,
  TicketStatus,
  TicketPriority,
  TicketSource,
  MessageSenderType,
  MessageContentType,
  ModerationStatus,
  KbArticleStatus,
  KbArticleSource,
  LmsAuthMethod,
  LmsSyncType,
  LmsSyncStatus,
  VoiceCallDirection,
  VoiceCallStatus,
  HandoffStatus,
  HandoffFromType,
  AgeGroup,
  OrganizationPlan,
  FerpaAction,
  FerpaResourceType,
  ConsentType,
  DataRequestType,
  DataRequestStatus,
} from '../enums';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  mfaEnabled: boolean;
  lmsUserId?: string;
  lmsPlatform?: LmsPlatform;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  organizationId: string;
  email?: string;
  name?: string;
  phone?: string;
  lmsUserId?: string;
  lmsPlatform?: LmsPlatform;
  role?: UserRole;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  customerId?: string;
  lmsUserId?: string;
  lmsPlatform?: LmsPlatform;
  lmsCourseId?: string;
  userRole?: UserRole;
  channel: ConversationChannel;
  status: ConversationStatus;
  assignedAgentId?: string;
  aiModelConfig?: AiModelConfig;
  contentModerationEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId?: string;
  content: string;
  contentType: MessageContentType;
  moderationStatus?: ModerationStatus;
  moderationFlags?: Record<string, unknown>;
  ferpaAuditLogged: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Ticket {
  id: string;
  subject: string;
  description?: string;
  customerId?: string;
  organizationId: string;
  lmsUserId?: string;
  lmsPlatform?: LmsPlatform;
  lmsCourseId?: string;
  userRole?: UserRole;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId?: string;
  assignedAgentId?: string;
  aiClassification?: AiTicketClassification;
  aiSuggestedResponse?: string;
  aiConfidenceScore?: number;
  slaDeadline?: Date;
  source: TicketSource;
  externalRefs?: Record<string, unknown>;
  ferpaAuditLogged: boolean;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

export interface KbArticle {
  id: string;
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  status: KbArticleStatus;
  source: KbArticleSource;
  sourceTicketId?: string;
  lmsPlatform?: LmsPlatform;
  targetRole?: UserRole;
  createdBy?: string;
  reviewedBy?: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  tags: string[];
  version: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface LmsIntegration {
  id: string;
  organizationId: string;
  lmsPlatform: LmsPlatform;
  lmsInstanceUrl?: string;
  authMethod: LmsAuthMethod;
  syncEnabled: boolean;
  lastSyncAt?: Date;
  syncFrequency: string;
  webhookEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LmsUser {
  id: string;
  organizationId: string;
  lmsIntegrationId: string;
  lmsUserId: string;
  lmsPlatform: LmsPlatform;
  email?: string;
  name?: string;
  role?: UserRole;
  lmsRole?: string;
  courses?: Record<string, unknown>;
  syncedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LmsCourse {
  id: string;
  lmsIntegrationId: string;
  lmsCourseId: string;
  lmsPlatform: LmsPlatform;
  courseName: string;
  courseCode?: string;
  teacherIds?: string[];
  studentCount?: number;
  metadata: Record<string, unknown>;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LmsAssignment {
  id: string;
  lmsIntegrationId: string;
  lmsAssignmentId: string;
  lmsCourseId: string;
  lmsPlatform: LmsPlatform;
  assignmentName: string;
  dueDate?: Date;
  description?: string;
  metadata: Record<string, unknown>;
  syncedAt?: Date;
  createdAt: Date;
}

export interface LmsSyncLog {
  id: string;
  lmsIntegrationId: string;
  syncType: LmsSyncType;
  status: LmsSyncStatus;
  recordsSynced?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface VoiceCall {
  id: string;
  conversationId?: string;
  lmsUserId?: string;
  lmsPlatform?: LmsPlatform;
  userRole?: UserRole;
  direction: VoiceCallDirection;
  phoneNumber: string;
  customerId?: string;
  agentId?: string;
  aiVoiceConfig?: Record<string, unknown>;
  status: VoiceCallStatus;
  durationSeconds?: number;
  recordingUrl?: string;
  recordingConsentGiven?: boolean;
  transcript?: string;
  aiSummary?: string;
  sentiment?: string;
  tutoringTopic?: string;
  studentStruggled?: boolean;
  escalatedToHuman?: boolean;
  metadata: Record<string, unknown>;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

export interface Handoff {
  id: string;
  conversationId: string;
  fromType: HandoffFromType;
  fromId?: string;
  toAgentId?: string;
  reason?: string;
  confidenceScore?: number;
  contextSummary?: string;
  status: HandoffStatus;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
}

export interface FerpaAuditLogEntry {
  id: string;
  resourceType: FerpaResourceType;
  resourceId?: string;
  action: FerpaAction;
  actorId?: string;
  actorRole?: UserRole;
  studentId?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface ContentModerationPolicy {
  id: string;
  organizationId: string;
  ageGroup: AgeGroup;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'strict';
  enabledCategories: string[];
  autoEscalate: boolean;
  notifyParent: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface FerpaConsent {
  id: string;
  studentId: string;
  parentId?: string;
  organizationId: string;
  consentType: ConsentType;
  consentGiven: boolean;
  consentDate?: Date;
  consentMethod?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface FerpaDataRequest {
  id: string;
  studentId: string;
  organizationId: string;
  requestType: DataRequestType;
  status: DataRequestStatus;
  requestedAt: Date;
  completedAt?: Date;
  exportedDataUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// AI-specific types
export interface AiModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  fallbackChain?: Array<{ provider: string; model: string }>;
}

export interface AiTicketClassification {
  category: string;
  targetRole: UserRole;
  priority: TicketPriority;
  suggestedTemplate?: string;
  aiConfidence: number;
  lmsContext?: Record<string, unknown>;
}

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  action: 'approve' | 'flag' | 'block';
}
