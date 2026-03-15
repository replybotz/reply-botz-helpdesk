import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketCategoriesService } from './ticket-categories.service';
import { TicketsController } from './tickets.controller';
import { FerpaComplianceModule } from '../ferpa-compliance/ferpa-compliance.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [FerpaComplianceModule, AiGatewayModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketCategoriesService],
  exports: [TicketsService],
})
export class TicketsModule {}
