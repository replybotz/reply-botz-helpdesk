import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { FerpaAuditService } from './ferpa-audit.service';
import { FerpaConsentService } from './ferpa-consent.service';
import { FerpaDataRequestService } from './ferpa-data-request.service';
import { FerpaComplianceController } from './ferpa-compliance.controller';

@Module({
  controllers: [FerpaComplianceController],
  providers: [EncryptionService, FerpaAuditService, FerpaConsentService, FerpaDataRequestService],
  exports: [EncryptionService, FerpaAuditService, FerpaConsentService, FerpaDataRequestService],
})
export class FerpaComplianceModule {}
