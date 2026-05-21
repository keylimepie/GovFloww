import { Module } from '@nestjs/common';
import { OrganisationController } from './organisation.controller';
import { OrganisationService } from './organisation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OrganisationController],
  providers: [OrganisationService],
})
export class OrganisationModule {}
