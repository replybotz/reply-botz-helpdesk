import type { UserRole } from '@/generated/prisma';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  mfaEnabled: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface MfaPendingResponse {
  requiresMfa: true;
  mfaToken: string;
}

export type AuthResponse = LoginResponse | MfaPendingResponse;
