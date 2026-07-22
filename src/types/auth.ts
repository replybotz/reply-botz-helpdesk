import type { UserRole } from '@/generated/prisma';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  mfaEnabled: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  /** Auth tokens are delivered as httpOnly cookies, not in the body. */
  expiresAt: Date;
}

export interface MfaPendingResponse {
  requiresMfa: true;
}

export type AuthResponse = LoginResponse | MfaPendingResponse;
