import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomBytes } from 'crypto';

export interface TokenPayload extends JWTPayload {
  sub: string;
  tenantId: string;
  role: string;
  email: string;
}

export interface MfaTokenPayload extends JWTPayload {
  sub: string;
  tenantId: string;
  mfaPending: true;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return new TextEncoder().encode(secret);
}

function parseExpiry(expiry: string): string {
  return expiry || '15m';
}

export async function signAccessToken(payload: {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    tenantId: payload.tenantId,
    role: payload.role,
    email: payload.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(parseExpiry(process.env.JWT_ACCESS_EXPIRY ?? '15m'))
    .sign(getSecret());
}

export async function signMfaToken(payload: {
  userId: string;
  tenantId: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    tenantId: payload.tenantId,
    mfaPending: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
  if ((payload as Record<string, unknown>).mfaPending) {
    throw new Error('MFA verification required');
  }
  return payload as TokenPayload;
}

export async function verifyMfaToken(token: string): Promise<MfaTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
  if (!(payload as Record<string, unknown>).mfaPending) {
    throw new Error('Invalid MFA token');
  }
  return payload as MfaTokenPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}
