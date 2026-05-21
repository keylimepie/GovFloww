import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { VirusScanService } from './virus-scan.service';

@Global()
@Module({
  providers: [StorageService, VirusScanService],
  exports: [StorageService, VirusScanService],
})
export class StorageModule {}
