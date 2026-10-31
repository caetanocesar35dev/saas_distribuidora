import { PartialType } from '@nestjs/swagger';
import { ReferralStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { MOBILE_MESSAGE, onlyPhoneDigits } from '../common/utils/phone';
import {
  normalizeReferralCode,
  REFERRAL_CODE_MESSAGE,
  REFERRAL_CODE_REGEX,
} from './referral-rules';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const toCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeReferralCode(value) : value;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });

// ---- Representantes ----------------------------------------------------------------------------

export class CreateRepresentativeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MaxLength(120)
  name: string;

  /** Telefone (WhatsApp) com DDD, fixo ou celular. Grava só os dígitos. */
  @Transform(({ value }) => onlyPhoneDigits(value))
  @IsString({ message: MOBILE_MESSAGE })
  @Matches(/^[1-9]{2}\d{8,9}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  phone: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string | null;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'A chave Pix é obrigatória.' })
  @MaxLength(140)
  pixKey: string;

  /** Sem código, o sistema cria um a partir do nome. */
  @IsOptional()
  @Transform(toCode)
  @IsString()
  @MaxLength(20, { message: REFERRAL_CODE_MESSAGE })
  @Matches(/^.{4,}$/, { message: REFERRAL_CODE_MESSAGE })
  @Matches(REFERRAL_CODE_REGEX, { message: REFERRAL_CODE_MESSAGE })
  code?: string;

  /** % do preço mensal do plano que o indicado assinar. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent: number;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateRepresentativeDto extends PartialType(
  CreateRepresentativeDto,
) {}

export class ListRepresentativesQuery {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  deleted?: boolean;
}

// ---- Indicações --------------------------------------------------------------------------------

export class ListReferralsQuery extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  /** CUSTOMER = indicado por um cliente; REPRESENTATIVE = por um representante. */
  @IsOptional()
  @IsIn(['CUSTOMER', 'REPRESENTATIVE'])
  source?: 'CUSTOMER' | 'REPRESENTATIVE';

  @IsOptional()
  @IsUUID()
  representativeId?: string;

  /** TO_PAY = comissão confirmada e não paga; PAID = Pix enviado. */
  @IsOptional()
  @IsIn(['TO_PAY', 'PAID'])
  commission?: 'TO_PAY' | 'PAID';

  /** Código, nome da organização indicada ou de quem indicou. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CommissionPaidDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CancelReferralDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(300)
  reason: string;
}
