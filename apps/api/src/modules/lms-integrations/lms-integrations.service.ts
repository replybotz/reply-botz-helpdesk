import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from '../ferpa-compliance/encryption.service';
import { LmsProviderFactory } from './lms-provider.factory';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../shared/queue/queue.module';

export interface CreateLmsIntegrationDto {
  organizationId: string;
  lmsPlatform: string;
  lmsInstanceUrl?: string;
  authMethod: string;
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  webhookSecret?: string;
}

@Injectable()
export class LmsIntegrationsService {
  private readonly logger = new Logger(LmsIntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly providerFactory: LmsProviderFactory,
    @InjectQueue(QUEUE_NAMES.LMS_SYNC) private readonly syncQueue: Queue,
  ) {}

  async create(dto: CreateLmsIntegrationDto) {
    const existing = await this.prisma.lmsIntegration.findFirst({
      where: { organizationId: dto.organizationId, lmsPlatform: dto.lmsPlatform },
    });
    if (existing) {
      throw new ConflictException(`${dto.lmsPlatform} integration already exists`);
    }

    return this.prisma.lmsIntegration.create({
      data: {
        organizationId: dto.organizationId,
        lmsPlatform: dto.lmsPlatform,
        lmsInstanceUrl: dto.lmsInstanceUrl,
        authMethod: dto.authMethod,
        accessToken: dto.accessToken ? this.encryption.encrypt(dto.accessToken) : undefined,
        refreshToken: dto.refreshToken ? this.encryption.encrypt(dto.refreshToken) : undefined,
        apiKey: dto.apiKey ? this.encryption.encrypt(dto.apiKey) : undefined,
        webhookSecret: dto.webhookSecret ? this.encryption.encrypt(dto.webhookSecret) : undefined,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.lmsIntegration.findMany({
      where: { organizationId },
      select: {
        id: true,
        lmsPlatform: true,
        lmsInstanceUrl: true,
        authMethod: true,
        syncEnabled: true,
        lastSyncAt: true,
        syncFrequency: true,
        webhookEnabled: true,
        createdAt: true,
        // Never return tokens/keys to clients
      },
    });
  }

  async triggerSync(integrationId: string, syncType: 'users' | 'courses' | 'assignments' | 'all') {
    const integration = await this.prisma.lmsIntegration.findUniqueOrThrow({
      where: { id: integrationId },
    });

    await this.syncQueue.add(
      `lms-sync-${syncType}`,
      { integrationId, syncType, lmsPlatform: integration.lmsPlatform },
      { jobId: `${integrationId}-${syncType}-${Date.now()}` },
    );

    this.logger.log(`Queued LMS sync: ${integration.lmsPlatform} (${syncType})`);
    return { queued: true, syncType };
  }

  async testConnection(integrationId: string) {
    const integration = await this.prisma.lmsIntegration.findUniqueOrThrow({
      where: { id: integrationId },
    });
    const provider = this.providerFactory.getProvider(integration.lmsPlatform);
    return provider.testConnection(integrationId);
  }

  async getSyncLogs(integrationId: string, limit = 50) {
    return this.prisma.lmsSyncLog.findMany({
      where: { lmsIntegrationId: integrationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  getSupportedPlatforms() {
    return this.providerFactory.getSupportedPlatforms().map((platform) => {
      const provider = this.providerFactory.getProvider(platform);
      return {
        platform,
        name: provider.name,
        capabilities: provider.capabilities,
        authMethod: provider.authMethod,
      };
    });
  }
}
