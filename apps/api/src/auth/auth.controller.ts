// =============================================
// Auth Controller — Login, Register, Refresh, Logout
// =============================================

import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/pipes';
import { Public, CurrentUser, ClientIp } from '../common/decorators';
import { createCsrfToken, CSRF_COOKIE_NAME } from '../common/csrf';
import { LoginSchema, RegisterSchema } from '@govflow/shared';
import type { LoginInput, RegisterInput, JwtPayload } from '@govflow/shared';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginInput,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, ip);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    this.setCsrfCookie(response);
    return { success: true, data: { user: result.user } };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterInput, @ClientIp() ip: string) {
    const result = await this.authService.register(dto, ip);
    return { success: true, data: result };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: { refreshToken?: string },
    @ClientIp() ip: string,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const refreshToken = dto?.refreshToken || request.cookies?.govflow_refresh;
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    const result = await this.authService.refreshAccessToken(refreshToken, ip);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    this.setCsrfCookie(response);
    return { success: true, data: {} };
  }

  @Get('me')
  async me(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionUser = await this.authService.getSessionUser(user.sub);
    this.setCsrfCookie(response);
    return { success: true, data: { user: sessionUser } };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body('refreshToken') refreshToken: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    await this.authService.logout(refreshToken || request.cookies?.govflow_refresh || '', user.sub, ip);
    this.clearAuthCookies(response);
    this.clearCsrfCookie(response);
    return { success: true, message: 'Logged out successfully' };
  }

  private setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
    const secure = this.configService.get('NODE_ENV') === 'production';
    response.cookie('govflow_access', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    response.cookie('govflow_refresh', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie('govflow_access', { path: '/' });
    response.clearCookie('govflow_refresh', { path: '/' });
  }

  private setCsrfCookie(response: Response) {
    const secure = this.configService.get('NODE_ENV') === 'production';
    const secret = this.configService.get<string>('CSRF_SECRET') || this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    response.cookie(CSRF_COOKIE_NAME, createCsrfToken(secret), {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearCsrfCookie(response: Response) {
    response.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
  }
}
