import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LmsIntegrationsController } from './lms-integrations.controller';
import { LmsIntegrationsService } from './lms-integrations.service';
import { LmsProviderFactory } from './lms-provider.factory';
import { LmsSyncProcessor } from './lms-sync.processor';
import { LmsSyncScheduler } from './lms-sync.scheduler';
import { GoogleClassroomProvider } from './providers/google-classroom.provider';
import { CanvasProvider } from './providers/canvas.provider';
import {
  MoodleProvider,
  SchoologyProvider,
  BlackboardProvider,
  TalentLmsProvider,
  D2LBrightspaceProvider,
  CypherLearningProvider,
  AbsorbLmsProvider,
  DiscoProvider,
  LearnDashProvider,
} from './providers/stub-lms.providers';
import { FerpaComplianceModule } from '../ferpa-compliance/ferpa-compliance.module';
import { QUEUE_NAMES } from '../../shared/queue/queue.module';

@Module({
  imports: [
    FerpaComplianceModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.LMS_SYNC }),
  ],
  controllers: [LmsIntegrationsController],
  providers: [
    LmsIntegrationsService,
    LmsProviderFactory,
    LmsSyncProcessor,
    LmsSyncScheduler,
    GoogleClassroomProvider,
    CanvasProvider,
    MoodleProvider,
    SchoologyProvider,
    BlackboardProvider,
    TalentLmsProvider,
    D2LBrightspaceProvider,
    CypherLearningProvider,
    AbsorbLmsProvider,
    DiscoProvider,
    LearnDashProvider,
  ],
  exports: [LmsIntegrationsService, LmsProviderFactory],
})
export class LmsIntegrationsModule {}
