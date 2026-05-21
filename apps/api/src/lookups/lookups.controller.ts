import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import { LookupsService } from './lookups.service';
import type { JwtPayload } from '@govflow/shared';

@Controller('api/lookups')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get('bootstrap')
  async bootstrap(@CurrentUser() user: JwtPayload) {
    const data = await this.lookupsService.getBootstrap(user);
    return { success: true, data };
  }
}
