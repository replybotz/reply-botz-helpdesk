import { z } from 'zod';

export const createConversationSchema = z.object({
  channel: z
    .enum(['LIVE_CHAT', 'EMAIL', 'VOICE', 'WHATSAPP', 'FACEBOOK', 'TELEGRAM', 'SLACK', 'TWITTER', 'API'])
    .optional()
    .default('LIVE_CHAT'),
  customerId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  role: z.enum(['CUSTOMER', 'AGENT', 'AI', 'SYSTEM']).optional(),
});

export const updateConversationSchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
