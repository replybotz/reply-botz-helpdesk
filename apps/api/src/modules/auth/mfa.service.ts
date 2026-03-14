import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class MfaService {
  async generateSecret(email: string, issuer = 'Reply Botz HD'): Promise<MfaSetup> {
    const secret = speakeasy.generateSecret({
      name: `${issuer} (${email})`,
      issuer,
      length: 32,
    });

    const otpauthUrl = secret.otpauth_url ?? '';
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step (30s) grace period
    });
  }

  generateBackupCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }
}
