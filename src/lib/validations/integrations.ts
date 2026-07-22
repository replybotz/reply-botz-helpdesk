import { z } from 'zod';

export const createIntegrationSchema = z.object({
  type: z.string().min(1, 'Type is required').max(50),
  config: z.record(z.string(), z.unknown()),
});

export const updateIntegrationSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERROR']).optional(),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
