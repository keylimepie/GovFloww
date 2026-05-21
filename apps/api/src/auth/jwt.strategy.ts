// =============================================
// JWT Strategy — Passport.js Integration
// =============================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@govflow/shared';
import { Request } from 'express';

const cookieExtractor = (request: Request): string | null => {
  return request?.cookies?.govflow_access || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * This runs after JWT signature verification.
   * The returned object is attached to request.user.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }
}
