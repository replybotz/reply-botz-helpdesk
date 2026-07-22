import { z } from 'zod';

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().max(255).nullable().optional(),
  plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional().default('FREE'),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
