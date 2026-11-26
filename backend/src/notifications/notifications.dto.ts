import { PartialType } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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
const trimEach = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? (value as unknown[]).map((v) => (typeof v === 'string' ? v.trim() : v))
    : value;

/** Limites da enquete (decidido pelo usuário, 2026-11-18). */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;
export const POLL_OPTION_MAX_LENGTH = 100;

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

  // ---- Enquete (type = POLL) ----

  /** Opções da enquete, na ordem em que aparecem (de 2 a 10, sem repetir). */
  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMinSize(POLL_MIN_OPTIONS, {
    message: `A enquete precisa de pelo menos ${POLL_MIN_OPTIONS} opções.`,
  })
  @ArrayMaxSize(POLL_MAX_OPTIONS, {
    message: `A enquete pode ter no máximo ${POLL_MAX_OPTIONS} opções.`,
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Preencha o texto de todas as opções.' })
  @MaxLength(POLL_OPTION_MAX_LENGTH, { each: true })
  pollOptions?: string[];

  /** Prazo para votar: obrigatório na enquete. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  pollEndsAt?: Date;

  /** true = cada pessoa pode marcar mais de uma opção. Padrão: uma só. */
  @IsOptional()
  @IsBoolean()
  pollMultiple?: boolean;
}

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}

/** Voto numa enquete: a lista completa das opções escolhidas (substitui o voto anterior). */
export class VotePollDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Escolha uma opção.' })
  @ArrayMaxSize(POLL_MAX_OPTIONS)
  @ArrayUnique()
  @IsString({ each: true })
  optionIds: string[];
}

export class ListMyNotificationsQuery extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;
}
