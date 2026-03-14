import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from '../ferpa-compliance/encryption.service';
import { FerpaAuditService } from '../ferpa-compliance/ferpa-audit.service';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

export interface CreateUserDto {
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  lmsUserId?: string;
  lmsPlatform?: string;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly ferpaAudit: FerpaAuditService,
  ) {}

  async create(dto: CreateUserDto, actorId?: string) {
    const passwordHash = dto.password
      ? await argon2.hash(dto.password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        })
      : undefined;

    const user = await this.prisma.user.create({
      data: {
        organizationId: dto.organizationId,
        email: this.encryption.encrypt(dto.email),
        name: this.encryption.encrypt(dto.name),
        role: dto.role,
        passwordHash,
        lmsUserId: dto.lmsUserId,
        lmsPlatform: dto.lmsPlatform,
        isActive: true,
      },
    });

    // FERPA audit log for student creation
    if (dto.role === UserRole.STUDENT) {
      await this.ferpaAudit.log({
        resourceType: 'user',
        resourceId: user.id,
        action: 'create',
        actorId,
        studentId: dto.email,
      });
    }

    return this.decryptUser(user);
  }

  async findById(id: string, actorId?: string, actorRole?: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        lmsUserId: true,
        lmsPlatform: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // FERPA audit: log access to student records
    if (user.role === UserRole.STUDENT && actorId) {
      await this.ferpaAudit.log({
        resourceType: 'user',
        resourceId: id,
        action: 'view',
        actorId,
        actorRole,
        studentId: this.tryDecrypt(user.email),
      });
    }

    return this.decryptUser(user);
  }

  async findAll(
    organizationId: string,
    options?: { role?: UserRole; search?: string; page?: number; limit?: number },
  ) {
    const { role, page = 1, limit = 20 } = options ?? {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId, ...(role ? { role } : {}), isActive: true },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          mfaEnabled: true,
          avatarUrl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { organizationId, ...(role ? { role } : {}) } }),
    ]);

    return {
      data: users.map((u) => this.decryptUser(u)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    const updates: Record<string, unknown> = {};
    if (dto.name) updates.name = this.encryption.encrypt(dto.name);
    if (dto.role !== undefined) updates.role = dto.role;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.avatarUrl) updates.avatarUrl = dto.avatarUrl;

    const user = await this.prisma.user.update({
      where: { id },
      data: updates,
    });
    return this.decryptUser(user);
  }

  async deactivate(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private decryptUser<T extends { email?: string | null; name?: string | null }>(user: T): T {
    return {
      ...user,
      email: user.email ? this.tryDecrypt(user.email) : user.email,
      name: user.name ? this.tryDecrypt(user.name) : user.name,
    };
  }

  private tryDecrypt(value: string): string {
    try {
      return this.encryption.decrypt(value);
    } catch {
      return value; // Return as-is if decryption fails
    }
  }
}
