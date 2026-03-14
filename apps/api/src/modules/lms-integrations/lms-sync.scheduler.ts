import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../shared/queue/queue.module';

@Injectable()
export class LmsSyncScheduler {
  private readonly logger = new Logger(LmsSyncScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.LMS_SYNC) private readonly syncQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledHourlySync() {
    this.logger.log('Running scheduled hourly LMS sync');

    const integrations = await this.prisma.lmsIntegration.findMany({
      where: { syncEnabled: true, syncFrequency: 'hourly' },
    });

    for (const integration of integrations) {
      await this.syncQueue.add(
        'scheduled-sync',
        {
          integrationId: integration.id,
          syncType: 'all',
          lmsPlatform: integration.lmsPlatform,
        },
        {
          jobId: `scheduled-${integration.id}-${Date.now()}`,
          priority: 10, // Lower priority than manual syncs
        },
      );
    }

    this.logger.log(`Queued ${integrations.length} scheduled LMS syncs`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledDailySync() {
    this.logger.log('Running scheduled daily LMS sync');

    const integrations = await this.prisma.lmsIntegration.findMany({
      where: { syncEnabled: true, syncFrequency: 'daily' },
    });

    for (const integration of integrations) {
      await this.syncQueue.add(
        'scheduled-sync-daily',
        {
          integrationId: integration.id,
          syncType: 'all',
          lmsPlatform: integration.lmsPlatform,
        },
        {
          jobId: `scheduled-daily-${integration.id}-${Date.now()}`,
          priority: 10,
        },
      );
    }
  }
}
