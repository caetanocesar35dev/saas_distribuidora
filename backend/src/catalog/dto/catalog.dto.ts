import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

// ---- Produto (catálogo da empresa) ------------------------------------------------------------

export class ProductStoreOfferDto {
  @IsUUID()
  storeId: string;

  @IsNumber(MONEY)
  @Min(0, { message: 'O preço não pode ser negativo.' })
  price: number;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0, { message: 'O custo não pode ser negativo.' })
  costPrice?: number;
}

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome do produto é obrigatório.' })
  @MaxLength(200)
  name: string;

  /** Código de barras. Se omitido, o sistema gera um EAN-13. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'A quantidade por fardo deve ser no mínimo 1.' })
  packQuantity?: number;

  @IsOptional()
  @IsUUID()
  bottleTypeId?: string;

  /** Custo padrão das lojas informadas em `stores` (cada loja pode sobrescrever). */
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  costPrice?: number;

  /** Lojas em que o produto passa a ser vendido, com preço independente por loja. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductStoreOfferDto)
  stores?: ProductStoreOfferDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  packQuantity?: number;

  /** null remove o vasilhame do produto. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bottleTypeId?: string | null;
}

export class ListProductsQuery extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  /** true lista só os produtos excluídos (para reativar). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  deleted?: boolean;
}

// ---- Oferta do produto na loja ------------------------------------------------------------------

export class AddStoreProductDto {
  @IsUUID()
  productId: string;

  @IsNumber(MONEY)
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}

/** Estoque NÃO é editável aqui: use entrada de mercadoria ou ajuste de inventário. */
export class UpdateStoreProductDto {
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StockEntryDto {
  @IsInt()
  @Min(1, { message: 'A quantidade da entrada deve ser maior que zero.' })
  @Max(1_000_000)
  quantity: number;
}

export class StockAdjustmentDto {
  @IsInt()
  @Min(0, { message: 'O estoque não pode ser negativo.' })
  @Max(1_000_000)
  newStock: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do ajuste.' })
  @MaxLength(300)
  reason: string;
}

export class ListStoreProductsQuery extends PaginationQueryDto {
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

export class LowStockQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold?: number;
}

// ---- Tipos de vasilhame -----------------------------------------------------------------------------

export class CreateBottleTypeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class UpdateBottleTypeDto extends PartialType(
  OmitType(CreateBottleTypeDto, [] as const),
) {}
