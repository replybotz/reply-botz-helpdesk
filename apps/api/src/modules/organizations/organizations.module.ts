import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { FerpaComplianceModule } from '../ferpa-compliance/ferpa-compliance.module';

@Module({
  imports: [FerpaComplianceModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
