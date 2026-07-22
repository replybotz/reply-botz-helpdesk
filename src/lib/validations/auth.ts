import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  tenantSlug: z.string().min(1, 'Tenant is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().min(1, 'Display name is required').max(255),
  tenantSlug: z.string().min(1, 'Tenant is required'),
});

// The setup flow deliberately shares this schema: the TOTP secret is held
// server-side between setup and verification and is never client-supplied.
export const mfaVerifySchema = z.object({
  token: z.string().length(6, 'MFA code must be 6 digits').regex(/^\d+$/, 'MFA code must be numeric'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
