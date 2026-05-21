// =============================================
// App Module — Root Module
// =============================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AuditModule } from './audit/audit.module';
import { LookupsModule } from './lookups/lookups.module';
import { RolesModule } from './roles/roles.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CronModule } from './cron/cron.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { CsrfGuard } from './common/csrf.guard';
import { MustChangePasswordGuard } from './common/must-change-password.guard';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { OrganisationModule } from './organisation/organisation.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    // Load .env file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      expandVariables: true,
      validate: validateEnv,
    }),

    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Background Jobs and Cron
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    ScheduleModule.forRoot(),

    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkflowsModule,
    SubmissionsModule,
    AuditModule,
    LookupsModule,
    RolesModule,
    StorageModule,
    NotificationsModule,
    CronModule,
    HealthModule,
    OrganisationModule,
    ReportsModule,
  ],
  providers: [
    // Global JWT auth guard — all routes require auth unless @Public() is used
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Force first-login password changes before privileged mutations
    {
      provide: APP_GUARD,
      useClass: MustChangePasswordGuard,
    },
    // CSRF protection for httpOnly-cookie authenticated mutation requests
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
