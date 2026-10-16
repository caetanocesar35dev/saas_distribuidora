import { PaymentMethod, SaleStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class SaleItemDto {
  @IsUUID()
  storeProductId: string;

  @IsInt()
  @Min(1, { message: 'A quantidade de cada produto deve ser maior que zero.' })
  @Max(100_000)
  quantity: number;
}

export class BottleReturnDto {
  @IsUUID()
  bottleTypeId: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity: number;
}

/** O preço e o custo NÃO vêm do cliente: são sempre lidos do banco. */
export class CreateSaleDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0, { message: 'O desconto não pode ser negativo.' })
  @Max(100_000_000)
  discount?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'A venda deve conter pelo menos um item.' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  /** Vasilhames que o cliente devolve na hora da venda. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BottleReturnDto)
  bottleReturns?: BottleReturnDto[];
}

export class ListSalesQuery extends PaginationQueryDto {
  /** Começo do identificador da venda. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  search?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Dia inicial (YYYY-MM-DD), no fuso da aplicação. */
  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'startDate deve estar no formato AAAA-MM-DD.',
  })
  startDate?: string;

  /** Dia final (YYYY-MM-DD), inclusive, no fuso da aplicação. */
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'endDate deve estar no formato AAAA-MM-DD.' })
  endDate?: string;
}

// ---- Comandas -------------------------------------------------------------------------------------

export class CreateCommandTabDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome da comanda é obrigatório.' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class AddCommandItemDto {
  @IsUUID()
  storeProductId: string;

  @IsInt()
  @Min(1, { message: 'A quantidade deve ser maior que zero.' })
  @Max(100_000)
  quantity: number;
}

export class CloseCommandTabDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(100_000_000)
  discount?: number;

  /** Se omitido, usa o cliente da comanda. */
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BottleReturnDto)
  bottleReturns?: BottleReturnDto[];
}

export class ListCommandTabsQuery {
  @IsOptional()
  @IsEnum({ OPEN: 'OPEN', CLOSED: 'CLOSED' })
  status?: 'OPEN' | 'CLOSED';
}
