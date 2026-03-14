import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

export const EVENTS = {
  // Ticket events
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_CLOSED: 'ticket.closed',
  TICKET_ASSIGNED: 'ticket.assigned',

  // Chat/Conversation events
  CONVERSATION_CREATED: 'conversation.created',
  CHAT_MESSAGE_RECEIVED: 'chat.message.received',
  CHAT_MESSAGE_SENT: 'chat.message.sent',
  CHAT_AI_RESPONSE_GENERATED: 'chat.ai.response.generated',

  // LMS events
  LMS_USER_SYNCED: 'lms.user.synced',
  LMS_COURSE_SYNCED: 'lms.course.synced',
  LMS_SYNC_COMPLETED: 'lms.sync.completed',
  LMS_SYNC_FAILED: 'lms.sync.failed',

  // KB events
  KB_ARTICLE_CREATED: 'kb.article.created',
  KB_ARTICLE_GENERATED: 'kb.article.generated',
  KB_ARTICLE_PUBLISHED: 'kb.article.published',

  // Voice events
  VOICE_CALL_STARTED: 'voice.call.started',
  VOICE_CALL_ENDED: 'voice.call.ended',
  VOICE_HANDOFF_TRIGGERED: 'voice.handoff.triggered',

  // FERPA events
  FERPA_AUDIT_LOGGED: 'ferpa.audit.logged',
  FERPA_DATA_REQUEST_CREATED: 'ferpa.data_request.created',

  // Content moderation events
  CONTENT_FLAGGED: 'content.flagged',
  CONTENT_ESCALATED: 'content.escalated',

  // Handoff events
  HANDOFF_REQUESTED: 'handoff.requested',
  HANDOFF_ACCEPTED: 'handoff.accepted',
  HANDOFF_COMPLETED: 'handoff.completed',
} as const;

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
  ],
  exports: [EventEmitterModule],
})
export class EventsModule {}
