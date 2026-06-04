import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { DorController } from './dor.controller';
import { DorService } from './dor.service';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [DorController],
  providers: [DorService],
  exports: [DorService],
})
export class DorModule {}
