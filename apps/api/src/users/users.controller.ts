import {
  Controller, Get, Post, Put, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PermissionsGuard } from '../common/guards';
import { RequirePermissions, CurrentUser, ClientIp } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangeUserStatusSchema,
  ChangePasswordSchema,
  EnableMfaSchema,
} from '@govflow/shared';
import type { ChangePasswordInput, CreateUserInput, EnableMfaInput, UpdateUserInput, JwtPayload } from '@govflow/shared';

@Controller('api/users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('user:create')
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const created = await this.usersService.create(dto, user, ip);
    return { success: true, data: created };
  }

  @Get()
  @RequirePermissions('user:create', 'user:update', 'user:view_branch', 'user:manage_dept')
  async findAll(@CurrentUser() user: JwtPayload) {
    const users = await this.usersService.findAll(user);
    return { success: true, data: users };
  }

  @Post('me/signature-pin')
  async setupSignaturePin(
    @Body() dto: { pin: string },
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    await this.usersService.setupSignaturePin(user.sub, dto.pin, ip);
    return { success: true, message: 'Signature PIN successfully set' };
  }

  @Post('me/password')
  async changeOwnPassword(
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    await this.usersService.changeOwnPassword(user.sub, dto, ip);
    return { success: true, message: 'Password changed successfully' };
  }

  @Post('me/mfa/setup')
  async setupMfa(@CurrentUser() user: JwtPayload) {
    const data = await this.usersService.setupMfa(user.sub, user.email);
    return { success: true, data };
  }

  @Post('me/mfa/enable')
  async enableMfa(
    @Body(new ZodValidationPipe(EnableMfaSchema)) dto: EnableMfaInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    await this.usersService.enableMfa(user.sub, dto.code, ip);
    return { success: true, message: 'MFA enabled successfully' };
  }

  @Post('me/mfa/disable')
  async disableMfa(
    @Body(new ZodValidationPipe(EnableMfaSchema)) dto: EnableMfaInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    await this.usersService.disableMfa(user.sub, dto.code, ip);
    return { success: true, message: 'MFA disabled successfully' };
  }

  @Get('pending-contractors')
  @RequirePermissions('user:create', 'user:update', 'user:manage_dept')
  async getPendingContractors() {
    const contractors = await this.usersService.getPendingContractors();
    return { success: true, data: contractors };
  }

  @Get(':id')
  @RequirePermissions('user:create', 'user:update', 'user:view_branch', 'user:manage_dept')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return { success: true, data: user };
  }

  @Put(':id')
  @RequirePermissions('user:update')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const updated = await this.usersService.update(id, dto, user, ip);
    return { success: true, data: updated };
  }

  @Patch(':id/status')
  @RequirePermissions('user:update')
  async changeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeUserStatusSchema)) dto: { status: string; reason?: string },
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    await this.usersService.changeStatus(id, dto.status, dto.reason, user, ip);
    return { success: true, message: `User status changed to ${dto.status}` };
  }
}
