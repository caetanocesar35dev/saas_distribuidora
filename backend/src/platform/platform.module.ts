import { Module } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MyNotificationsController,
  PlatformController,
  PlatformNotificationsController,
} from './platform.controllers';
import { PlatformService } from './platform.service';

@Module({
  controllers: [
    PlatformController,
    PlatformNotificationsController,
    MyNotificationsController,
  ],
  providers: [PlatformService, NotificationsService],
  exports: [PlatformService, NotificationsService],
})
export class PlatformModule {}
