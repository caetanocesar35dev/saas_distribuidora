import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateProfileDto } from '../auth/dto/auth.dto';
import { CurrentUser } from '../common/decorators/access.decorators';
import type { AuthUser } from '../common/decorators/access.decorators';
import { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  profile(@CurrentUser() user: AuthUser) {
    return this.me.profile(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.me.updateProfile(user.id, dto);
  }

  @Get('memberships')
  memberships(@CurrentUser() user: AuthUser) {
    return this.me.memberships(user.id);
  }
}
