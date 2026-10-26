import { PartialType } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

export class CreateCustomerDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome do cliente é obrigatório.' })
  @MaxLength(150)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  /**
   * Limite de crédito no fiado (soma de todas as lojas). `null` tira o limite. Só gerente e dono
   * podem enviar este campo (o service recusa com 403 para o atendente).
   */
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(10_000_000)
  creditLimit?: number | null;

  // ---- Endereço (opcional; mesmo formato do endereço da loja) -----------------------------
  // Texto vazio apaga o campo (o service grava null).
  @IsOptional() @Transform(trim) @IsString() @MaxLength(9) zipCode?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) street?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(20) number?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  complement?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  neighborhood?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) city?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^([A-Za-z]{2})?$/, { message: 'O estado deve ter 2 letras (UF).' })
  state?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class ListCustomersQuery extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Só clientes com dívida de fiado nas lojas que quem pede enxerga. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  withDebt?: boolean;
}

export class PaymentAllocationDto {
  @IsUUID()
  storeId: string;

  @IsNumber(MONEY)
  @Min(0.01)
  @Max(10_000_000)
  amount: number;
}

export class CreatePaymentDto {
  @IsNumber(MONEY)
  @Min(0.01, { message: 'O valor do pagamento deve ser maior que zero.' })
  @Max(10_000_000)
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /** Como distribuir o valor entre as dívidas das lojas. Sem isto, a distribuição é automática. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations?: PaymentAllocationDto[];
}
