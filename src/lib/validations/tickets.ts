import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  conversationId: z.string().uuid().optional(),
});

export const updateTicketSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  description: z.string().min(1).optional(),
  status: z
    .enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_THIRD_PARTY', 'RESOLVED', 'CLOSED'])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
