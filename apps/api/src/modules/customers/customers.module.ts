import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { FerpaComplianceModule } from '../ferpa-compliance/ferpa-compliance.module';

@Module({
  imports: [FerpaComplianceModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
