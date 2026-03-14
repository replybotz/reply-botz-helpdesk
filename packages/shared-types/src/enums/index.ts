export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEAM_LEAD = 'TEAM_LEAD',
  AGENT = 'AGENT',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT',
}

export enum LmsPlatform {
  GOOGLE_CLASSROOM = 'google_classroom',
  CANVAS = 'canvas',
  MOODLE = 'moodle',
  SCHOOLOGY = 'schoology',
  BLACKBOARD = 'blackboard',
  TALENT_LMS = 'talentlms',
  D2L_BRIGHTSPACE = 'd2l_brightspace',
  CYPHER_LEARNING = 'cypher_learning',
  ABSORB_LMS = 'absorb_lms',
  DISCO = 'disco',
  LEARNDASH = 'learndash',
}

export enum ConversationStatus {
  ACTIVE = 'active',
  WAITING = 'waiting',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum ConversationChannel {
  CHAT = 'chat',
  EMAIL = 'email',
  VOICE = 'voice',
  WHATSAPP = 'whatsapp',
  MESSENGER = 'messenger',
  SLACK = 'slack',
  TELEGRAM = 'telegram',
  DISCORD = 'discord',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_ON_CUSTOMER = 'waiting_on_customer',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketSource {
  EMAIL = 'email',
  CHAT = 'chat',
  VOICE = 'voice',
  MANUAL = 'manual',
  LMS = 'lms',
  API = 'api',
}

export enum MessageSenderType {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  AI = 'ai',
  SYSTEM = 'system',
}

export enum MessageContentType {
  TEXT = 'text',
  HTML = 'html',
  MARKDOWN = 'markdown',
  FILE = 'file',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  CAROUSEL = 'carousel',
  QUICK_REPLY = 'quick_reply',
}

export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  FLAGGED = 'flagged',
  BLOCKED = 'blocked',
}

export enum KbArticleStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum KbArticleSource {
  MANUAL = 'manual',
  AI_GENERATED = 'ai_generated',
  IMPORTED = 'imported',
  WEB_SCRAPED = 'web_scraped',
}

export enum LmsAuthMethod {
  OAUTH2 = 'oauth2',
  API_KEY = 'api_key',
  LTI = 'lti',
}

export enum LmsSyncType {
  USERS = 'users',
  COURSES = 'courses',
  ASSIGNMENTS = 'assignments',
  GRADES = 'grades',
}

export enum LmsSyncStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum VoiceCallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum VoiceCallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BUSY = 'busy',
  NO_ANSWER = 'no_answer',
}

export enum HandoffStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  COMPLETED = 'completed',
  TIMEOUT = 'timeout',
}

export enum HandoffFromType {
  AI = 'ai',
  AGENT = 'agent',
  SYSTEM = 'system',
}

export enum AiProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  PERPLEXITY = 'perplexity',
  OPENROUTER = 'openrouter',
}

export enum AiFeature {
  CHAT = 'chat',
  TICKET = 'ticket',
  KB_GENERATION = 'kb_generation',
  VOICE_TRANSCRIPTION = 'voice_transcription',
  VOICE_SYNTHESIS = 'voice_synthesis',
  EMBEDDING = 'embedding',
  MODERATION = 'moderation',
}

export enum FerpaAction {
  VIEW = 'view',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  ANONYMIZE = 'anonymize',
}

export enum FerpaResourceType {
  CONVERSATION = 'conversation',
  MESSAGE = 'message',
  TICKET = 'ticket',
  TICKET_EVENT = 'ticket_event',
  USER = 'user',
  CUSTOMER = 'customer',
  VOICE_CALL = 'voice_call',
}

export enum ConsentType {
  DATA_PROCESSING = 'data_processing',
  RECORDING = 'recording',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
}

export enum DataRequestType {
  EXPORT = 'export',
  DELETION = 'deletion',
  CORRECTION = 'correction',
  ACCESS = 'access',
}

export enum DataRequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export enum AgeGroup {
  K8 = 'k-8',
  HIGH_SCHOOL = '9-12',
  COLLEGE = 'college',
  ADULT = 'adult',
}

export enum OrganizationPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}
