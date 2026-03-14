import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FerpaComplianceModule } from '../ferpa-compliance/ferpa-compliance.module';

@Module({
  imports: [FerpaComplianceModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
