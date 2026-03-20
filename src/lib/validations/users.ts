import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().min(1, 'Display name is required').max(255),
  role: z.enum(['TENANT_ADMIN', 'SUPERVISOR', 'AGENT', 'CUSTOMER']),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  role: z.enum(['TENANT_ADMIN', 'SUPERVISOR', 'AGENT', 'CUSTOMER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
