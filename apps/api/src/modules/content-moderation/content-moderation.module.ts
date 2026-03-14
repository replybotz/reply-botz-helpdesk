import { Module } from '@nestjs/common';
import { ContentModerationService } from './content-moderation.service';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { FerpaComplianceModule } from '../ferpa-compliance/ferpa-compliance.module';

@Module({
  imports: [AiGatewayModule, FerpaComplianceModule],
  providers: [ContentModerationService],
  exports: [ContentModerationService],
})
export class ContentModerationModule {}
