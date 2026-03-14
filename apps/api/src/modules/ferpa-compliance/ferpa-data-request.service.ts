import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from './encryption.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '../../shared/events/events.module';

export interface CreateDataRequestDto {
  studentId: string;
  organizationId: string;
  requestType: 'export' | 'deletion' | 'correction' | 'access';
}

@Injectable()
export class FerpaDataRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateDataRequestDto) {
    const encryptedStudentId = this.encryption.encrypt(dto.studentId);

    const request = await this.prisma.ferpaDataRequest.create({
      data: {
        studentId: encryptedStudentId,
        organizationId: dto.organizationId,
        requestType: dto.requestType,
        status: 'pending',
        requestedAt: new Date(),
      },
    });

    this.eventEmitter.emit(EVENTS.FERPA_DATA_REQUEST_CREATED, request);
    return request;
  }

  async findByOrganization(organizationId: string) {
    return this.prisma.ferpaDataRequest.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: 'processing' | 'completed' | 'rejected',
    exportedDataUrl?: string,
  ) {
    return this.prisma.ferpaDataRequest.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : undefined,
        exportedDataUrl,
      },
    });
  }
}
