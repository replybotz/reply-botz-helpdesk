import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../shared/database/prisma.service';
import { LmsProviderFactory } from './lms-provider.factory';
import { QUEUE_NAMES } from '../../shared/queue/queue.module';

interface LmsSyncJobData {
  integrationId: string;
  syncType: 'users' | 'courses' | 'assignments' | 'all';
  lmsPlatform: string;
  courseId?: string;
}

@Processor(QUEUE_NAMES.LMS_SYNC)
export class LmsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(LmsSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: LmsProviderFactory,
  ) {
    super();
  }

  async process(job: Job<LmsSyncJobData>): Promise<void> {
    const { integrationId, syncType, lmsPlatform } = job.data;
    this.logger.log(`Processing LMS sync job: ${lmsPlatform} (${syncType})`);

    const syncLog = await this.prisma.lmsSyncLog.create({
      data: {
        lmsIntegrationId: integrationId,
        syncType,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      const provider = this.providerFactory.getProvider(lmsPlatform);
      let recordsSynced = 0;
      const errors: string[] = [];

      if (syncType === 'all' || syncType === 'courses') {
        const result = await provider.syncCourses(integrationId);
        recordsSynced += result.recordsSynced;
        errors.push(...result.errors);
      }

      if (syncType === 'all' || syncType === 'users') {
        const result = await provider.syncUsers(integrationId);
        recordsSynced += result.recordsSynced;
        errors.push(...result.errors);
      }

      if (syncType === 'assignments' && job.data.courseId) {
        const result = await provider.syncAssignments(integrationId, job.data.courseId);
        recordsSynced += result.recordsSynced;
        errors.push(...result.errors);
      }

      await this.prisma.lmsSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: errors.length > 0 ? 'completed' : 'completed',
          recordsSynced,
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `LMS sync completed: ${lmsPlatform} (${syncType}) — ${recordsSynced} records`,
      );
    } catch (err) {
      this.logger.error(`LMS sync failed: ${lmsPlatform}`, err);
      await this.prisma.lmsSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          errorMessage: (err as Error).message,
          completedAt: new Date(),
        },
      });
      throw err; // BullMQ will retry
    }
  }
}
