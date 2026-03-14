import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from '../ferpa-compliance/encryption.service';
import { MfaService } from './mfa.service';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterOrganizationDto {
  organizationName: string;
  organizationSlug: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface LoginDto {
  email: string;
  password: string;
  organizationSlug: string;
  mfaCode?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  requiresMfa?: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly mfaService: MfaService,
  ) {}

  async registerOrganization(dto: RegisterOrganizationDto): Promise<{ organizationId: string }> {
    // Check slug uniqueness
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (existing) {
      throw new ConflictException('Organization slug already taken');
    }

    const passwordHash = await argon2.hash(dto.adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const org = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        slug: dto.organizationSlug,
        users: {
          create: {
            email: this.encryption.encrypt(dto.adminEmail),
            name: this.encryption.encrypt(dto.adminName),
            role: UserRole.ADMIN,
            passwordHash,
            isActive: true,
          },
        },
      },
    });

    this.logger.log(`New organization registered: ${org.slug} (${org.id})`);
    return { organizationId: org.id };
  }

  async validateUser(email: string, password: string, organizationSlug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });
    if (!org) throw new NotFoundException('Organization not found');

    // Find user by encrypted email using hash-based lookup
    const emailHash = this.encryption.hash(email);
    const users = await this.prisma.user.findMany({
      where: { organizationId: org.id, isActive: true },
    });

    // Find matching user (email is stored encrypted)
    const user = users.find((u) => {
      try {
        return this.encryption.decrypt(u.email).toLowerCase() === email.toLowerCase();
      } catch {
        return false;
      }
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { user, org };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthTokens> {
    const { user, org } = await this.validateUser(
      dto.email,
      dto.password,
      dto.organizationSlug,
    );

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        return {
          accessToken: '',
          refreshToken: '',
          expiresIn: 0,
          requiresMfa: true,
        };
      }
      const mfaSecret = user.mfaSecret ? this.encryption.decrypt(user.mfaSecret) : null;
      if (!mfaSecret || !this.mfaService.verifyToken(mfaSecret, dto.mfaCode)) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(
      { sub: user.id, email: dto.email, role: user.role, organizationId: org.id },
      ipAddress,
      userAgent,
    );

    return tokens;
  }

  async generateTokens(
    payload: JwtPayload,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m');
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshTokenRaw = uuidv4();
    const refreshTokenHash = await argon2.hash(refreshTokenRaw, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    });
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      expiresIn: this.parseExpiry(accessExpiresIn),
    };
  }

  async refreshTokens(
    refreshTokenRaw: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    // Find non-revoked tokens
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    let validToken = null;
    for (const token of tokens) {
      try {
        const matches = await argon2.verify(token.tokenHash, refreshTokenRaw);
        if (matches) {
          validToken = token;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!validToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke the used token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: validToken.id },
      data: { revokedAt: new Date() },
    });

    const user = validToken.user;
    const decryptedEmail = this.encryption.decrypt(user.email);

    return this.generateTokens(
      {
        sub: user.id,
        email: decryptedEmail,
        role: user.role,
        organizationId: user.organizationId,
      },
      ipAddress,
      userAgent,
    );
  }

  async revokeRefreshToken(refreshTokenRaw: string): Promise<void> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null },
    });

    for (const token of tokens) {
      try {
        const matches = await argon2.verify(token.tokenHash, refreshTokenRaw);
        if (matches) {
          await this.prisma.refreshToken.update({
            where: { id: token.id },
            data: { revokedAt: new Date() },
          });
          return;
        }
      } catch {
        continue;
      }
    }
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      email: this.encryption.decrypt(user.email),
      name: this.encryption.decrypt(user.name),
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
