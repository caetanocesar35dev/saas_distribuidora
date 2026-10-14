import { BottleMovementType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Movimentações manuais; as de cliente nascem de venda, empréstimo ou devolução. */
export const MANUAL_MOVEMENT_TYPES = [
  'SUPPLIER_SEND',
  'SUPPLIER_RECEIVE',
  'MANUAL_ADJUSTMENT',
] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

export class ManualBottleMovementDto {
  @IsUUID()
  bottleTypeId: string;

  @IsIn(MANUAL_MOVEMENT_TYPES)
  type: ManualMovementType;

  /** Envio e recebimento: quantidade positiva. Ajuste: positivo soma, negativo subtrai. */
  @IsInt()
  @NotEquals(0, { message: 'A quantidade não pode ser zero.' })
  @Min(-1_000_000)
  @Max(1_000_000)
  quantity: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description?: string;
}

export class ListBottleMovementsQuery extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BottleMovementType)
  type?: BottleMovementType;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  bottleTypeId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

/** Devolução ou empréstimo avulso de vasilhame por um cliente. */
export class CustomerBottleDto {
  @IsUUID()
  bottleTypeId: string;

  @IsInt()
  @Min(1, { message: 'A quantidade deve ser maior que zero.' })
  @Max(1_000_000)
  quantity: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description?: string;
}
