import { PartialType } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateNotificationDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  /** Data de publicação; no futuro = notificação agendada. Padrão: agora. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date;

  /** null ou omitido = nunca expira. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;
}

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}

export class ListMyNotificationsQuery extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;
}
