import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from './encryption.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, UserRole } from '@prisma/client';
import { EVENTS } from '../../shared/events/events.module';

export interface FerpaAuditLogDto {
  resourceType: string;
  resourceId?: string;
  action: string;
  actorId?: string;
  actorRole?: UserRole;
  studentId?: string; // plaintext — will be encrypted before storage
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class FerpaAuditService {
  private readonly logger = new Logger(FerpaAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Log a FERPA audit event. This is an append-only operation.
   * Student IDs are encrypted before storage.
   */
  async log(dto: FerpaAuditLogDto): Promise<void> {
    try {
      const encryptedStudentId = dto.studentId
        ? this.encryption.encrypt(dto.studentId)
        : undefined;

      await this.prisma.ferpaAuditLog.create({
        data: {
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          action: dto.action,
          actorId: dto.actorId,
          actorRole: dto.actorRole,
          studentId: encryptedStudentId,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      this.eventEmitter.emit(EVENTS.FERPA_AUDIT_LOGGED, dto);
    } catch (err) {
      // FERPA audit failures must be surfaced — never silently fail
      this.logger.error('FERPA audit log write FAILED', err);
      throw err;
    }
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    limit = 100,
  ) {
    return this.prisma.ferpaAuditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findByActor(actorId: string, limit = 100) {
    return this.prisma.ferpaAuditLog.findMany({
      where: { actorId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findByStudentId(plainStudentId: string, organizationId: string, limit = 100) {
    const encryptedStudentId = this.encryption.encrypt(plainStudentId);
    return this.prisma.ferpaAuditLog.findMany({
      where: { studentId: encryptedStudentId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
