import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { HandoffsService } from './handoffs.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsGateway } from './conversations.gateway';
import { FerpaComplianceModule } from '../ferpa-compliance/ferpa-compliance.module';
import { ContentModerationModule } from '../content-moderation/content-moderation.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { QUEUE_NAMES } from '../../shared/queue/queue.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_PROCESSING }),
    FerpaComplianceModule,
    ContentModerationModule,
    AiGatewayModule,
  ],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    MessagesService,
    HandoffsService,
    ConversationsGateway,
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
