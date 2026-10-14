import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  RequirePlatformRole,
} from '../common/decorators/access.decorators';
import type { AuthUser } from '../common/decorators/access.decorators';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import {
  CreateNotificationDto,
  ListMyNotificationsQuery,
  UpdateNotificationDto,
} from '../notifications/notifications.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreatePlanDto,
  ListOrganizationsQuery,
  ListUsersQuery,
  SetUserActiveDto,
  UpdateOrganizationDto,
  UpdatePlanDto,
} from './dto/platform.dto';
import { PlatformService } from './platform.service';

// Rotas da plataforma: SUPPORT só lê; SUPERADMIN lê e escreve. Os ids aqui se chamam `:id` (e não
// organizationId etc.) porque esses nomes são reservados ao TenantGuard, que não atua nestas rotas.

@ApiTags('platform')
@ApiBearerAuth()
@RequirePlatformRole('SUPPORT', 'SUPERADMIN')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  // ---- Planos ----
  @Get('plans')
  listPlans() {
    return this.platform.listPlans();
  }

  @RequirePlatformRole('SUPERADMIN')
  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.platform.createPlan(dto);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.platform.updatePlan(id, dto);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Delete('plans/:id')
  removePlan(@Param('id') id: string) {
    return this.platform.removePlan(id);
  }

  // ---- Organizações ----
  @Get('organizations')
  listOrganizations(@Query() query: ListOrganizationsQuery) {
    return this.platform.listOrganizations(query);
  }

  @Get('organizations/:id')
  getOrganization(@Param('id') id: string) {
    return this.platform.getOrganization(id);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Patch('organizations/:id')
  updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.platform.updateOrganization(id, dto);
  }

  // ---- Usuários ----
  @Get('users')
  listUsers(@Query() query: ListUsersQuery) {
    return this.platform.listUsers(query);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Patch('users/:id/active')
  setUserActive(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetUserActiveDto,
  ) {
    return this.platform.setUserActive(actor.id, id, dto.isActive);
  }
}

@ApiTags('platform')
@ApiBearerAuth()
@RequirePlatformRole('SUPPORT', 'SUPERADMIN')
@Controller('platform/notifications')
export class PlatformNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.notifications.listAll(query);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNotificationDto) {
    return this.notifications.create(user.id, dto);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNotificationDto) {
    return this.notifications.update(id, dto);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notifications.remove(id);
  }
}

/** Notificações do próprio usuário. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/notifications')
export class MyNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyNotificationsQuery,
  ) {
    return this.notifications.listForUser(user.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @HttpCode(200)
  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
