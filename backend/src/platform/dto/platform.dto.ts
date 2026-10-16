import { PartialType } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

// ---- Planos ------------------------------------------------------------------------------------

export class CreatePlanDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceInCents: number;

  /** null = ilimitado. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  maxCompanies?: number | null;

  /** null = ilimitado. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  maxStoresPerCompany?: number | null;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

// ---- Organizações ---------------------------------------------------------------------------------

export class ListOrganizationsQuery extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsUUID()
  planId?: string;

  /** Nome da organização ou e-mail do responsável. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** Ajuste manual feito pela plataforma (cortesia, suporte, até a cobrança automática existir). */
export class UpdateOrganizationDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @IsOptional()
  @IsUUID()
  planId?: string;

  /** Estende (ou encurta) o período de teste. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Date)
  @IsDate()
  trialEndsAt?: Date | null;

  /** null limpa o atraso (cortesia). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Date)
  @IsDate()
  pastDueSince?: Date | null;
}

// ---- Usuários ----------------------------------------------------------------------------------------

export class ListUsersQuery extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class SetUserActiveDto {
  @IsBoolean()
  isActive: boolean;
}
