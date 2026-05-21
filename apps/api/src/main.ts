// =============================================
// GovFlow API — Entry Point
// =============================================

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';

// BigInt serialization fix — Prisma returns BigInt for large integer columns,
// but JSON.stringify cannot handle BigInt natively. This polyfill converts
// BigInt values to Number during JSON serialization.
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get('API_PORT', 3001);
  const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:5173');

  // ---- Security Middleware ----

  // Helmet: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));

  // CORS: strict origin whitelist
  app.enableCors({
    origin: corsOrigin.split(',').map((o: string) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });

  // Cookie parser for refresh tokens
  app.use(cookieParser());

  // Global exception filter — never leak internals
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ---- Start Server ----
  await app.listen(port);
  logger.log(`🚀 GovFlow API running on http://localhost:${port}`);
  logger.log(`📋 CORS enabled for: ${corsOrigin}`);
  logger.log(`🔒 Helmet security headers enabled`);
}

bootstrap();
