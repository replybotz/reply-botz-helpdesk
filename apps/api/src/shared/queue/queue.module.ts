import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const QUEUE_NAMES = {
  LMS_SYNC: 'lms-sync',
  AI_PROCESSING: 'ai-processing',
  EMAIL_INGESTION: 'email-ingestion',
  CONTENT_MODERATION: 'content-moderation',
  FERPA_AUDIT: 'ferpa-audit',
  NOTIFICATIONS: 'notifications',
  KB_GENERATION: 'kb-generation',
  DATA_RETENTION: 'data-retention',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.LMS_SYNC },
      { name: QUEUE_NAMES.AI_PROCESSING },
      { name: QUEUE_NAMES.EMAIL_INGESTION },
      { name: QUEUE_NAMES.CONTENT_MODERATION },
      { name: QUEUE_NAMES.FERPA_AUDIT },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.KB_GENERATION },
      { name: QUEUE_NAMES.DATA_RETENTION },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
