import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VirusScanService } from '../storage/virus-scan.service';

type HealthStatus = 'ok' | 'degraded';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly virusScan: VirusScanService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  async check() {
    const checks = {
      api: 'ok',
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      storage: await this.checkStorage(),
      antivirus: await this.checkAntivirus(),
    };

    const status: HealthStatus = Object.values(checks).every((value) => value === 'ok' || value === 'disabled')
      ? 'ok'
      : 'degraded';

    const payload = {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };

    if (status !== 'ok') {
      throw new ServiceUnavailableException(payload);
    }

    return { success: true, data: payload };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }

  private async checkRedis() {
    const client = new Redis({
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: Number(this.config.getOrThrow<string>('REDIS_PORT')),
      password: this.config.getOrThrow<string>('REDIS_PASSWORD'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      client.disconnect();
    }
  }

  private async checkStorage() {
    try {
      return (await this.storage.isHealthy()) ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  private async checkAntivirus() {
    try {
      return await this.virusScan.checkHealth();
    } catch {
      return 'unavailable';
    }
  }
}
