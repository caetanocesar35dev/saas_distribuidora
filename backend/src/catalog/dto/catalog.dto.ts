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
import { NO_CATEGORY } from '../product-categories';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
/** Nome da embalagem: sempre em minúsculas; texto vazio volta ao padrão ("fardo"). */
const toPackName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() || null : value;

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };
/** Custo da unidade: vem do custo da embalagem dividido, por isso tem até 4 casas. */
const UNIT_COST = { ...MONEY, maxDecimalPlaces: 4 };

// ---- Produto (catálogo da empresa) ------------------------------------------------------------

export class ProductStoreOfferDto {
  @IsUUID()
  storeId: string;

  @IsNumber(MONEY)
  @Min(0, { message: 'O preço não pode ser negativo.' })
  price: number;

  /** Preço próprio da embalagem. Sem ele, vale o preço da unidade × unidades da embalagem. */
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0, { message: 'O preço não pode ser negativo.' })
  packPrice?: number;

  @IsOptional()
  @IsNumber(UNIT_COST)
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

  /** Nome da embalagem (caixa, pacote...). Vazio ou ausente = "fardo". */
  @IsOptional()
  @Transform(toPackName)
  @IsString()
  @MaxLength(20)
  packName?: string | null;

  @IsOptional()
  @IsUUID()
  bottleTypeId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Custo padrão das lojas informadas em `stores` (cada loja pode sobrescrever). */
  @IsOptional()
  @IsNumber(UNIT_COST)
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

  /** Texto vazio ou null volta ao padrão ("fardo"). */
  @IsOptional()
  @Transform(toPackName)
  @IsString()
  @MaxLength(20)
  packName?: string | null;

  /** null remove o vasilhame do produto. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bottleTypeId?: string | null;

  /** null deixa o produto sem categoria. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;
}

export class ListProductsQuery extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Id da categoria, ou `none` para os produtos sem categoria. */
  @IsOptional()
  @ValidateIf((_, value) => value !== NO_CATEGORY)
  @IsUUID()
  categoryId?: string;

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
  packPrice?: number;

  @IsOptional()
  @IsNumber(UNIT_COST)
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

  /** null tira o preço próprio: a embalagem volta a ser unidade × unidades da embalagem. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber(MONEY)
  @Min(0)
  packPrice?: number | null;

  @IsOptional()
  @IsNumber(UNIT_COST)
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

  /** Id da categoria, ou `none` para os produtos sem categoria. */
  @IsOptional()
  @ValidateIf((_, value) => value !== NO_CATEGORY)
  @IsUUID()
  categoryId?: string;
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

  /**
   * Preço do casco quando o cliente compra o vasilhame (vale para a empresa toda). Ausente não
   * mexe; `null` tira o preço (o casco deixa de ser vendido).
   */
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01, { message: 'O preço do casco deve ser maior que zero.' })
  @Max(100_000)
  price?: number | null;
}

export class UpdateBottleTypeDto extends PartialType(
  OmitType(CreateBottleTypeDto, [] as const),
) {}

// ---- Categorias de produto ------------------------------------------------------------------------

export class CreateProductCategoryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome da categoria é obrigatório.' })
  @MaxLength(50)
  name: string;
}

export class UpdateProductCategoryDto extends PartialType(
  OmitType(CreateProductCategoryDto, [] as const),
) {}

export class ListProductCategoriesQuery {
  /** true lista só as categorias excluídas (para reativar). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  deleted?: boolean;
}
