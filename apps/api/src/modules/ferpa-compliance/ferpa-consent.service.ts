import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from './encryption.service';

export interface CreateConsentDto {
  studentId: string;
  parentId?: string;
  organizationId: string;
  consentType: string;
  consentGiven: boolean;
  consentMethod?: string;
}

@Injectable()
export class FerpaConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async createOrUpdate(dto: CreateConsentDto) {
    const encryptedStudentId = this.encryption.encrypt(dto.studentId);
    const encryptedParentId = dto.parentId ? this.encryption.encrypt(dto.parentId) : undefined;

    return this.prisma.ferpaConsent.create({
      data: {
        studentId: encryptedStudentId,
        parentId: encryptedParentId,
        organizationId: dto.organizationId,
        consentType: dto.consentType,
        consentGiven: dto.consentGiven,
        consentDate: new Date(),
        consentMethod: dto.consentMethod,
      },
    });
  }

  async hasConsent(
    studentId: string,
    organizationId: string,
    consentType: string,
  ): Promise<boolean> {
    const encryptedStudentId = this.encryption.encrypt(studentId);
    const consent = await this.prisma.ferpaConsent.findFirst({
      where: {
        studentId: encryptedStudentId,
        organizationId,
        consentType,
        consentGiven: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return !!consent;
  }
}
