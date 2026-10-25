import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
