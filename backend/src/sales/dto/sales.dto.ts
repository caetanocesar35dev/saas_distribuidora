import { PaymentMethod, SaleStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
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
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Item vendido: `quantity` são unidades avulsas e `packs` são fardos (venda em lote). O backend
 * converte para unidades com o tamanho do fardo do cadastro (`packQuantity`): 2 fardos de 12 +
 * 3 unidades = 27 unidades. Precisa ter pelo menos uma unidade no total.
 */
export class SaleItemDto {
  @IsUUID()
  storeProductId: string;

  @IsInt()
  @Min(0, { message: 'A quantidade não pode ser negativa.' })
  @Max(100_000)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'A quantidade de fardos não pode ser negativa.' })
  @Max(10_000)
  packs?: number;
}

export class BottleReturnDto {
  @IsUUID()
  bottleTypeId: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity: number;
}

/**
 * E-mail e senha do gerente ou dono que autoriza, na tela do atendente, a venda fiada acima do
 * limite. Só conferidos; nunca gravados.
 */
export class ManagerApprovalDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail do gerente inválido.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a senha do gerente.' })
  @MaxLength(72)
  password: string;
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

  /** Gerente ou dono confirma a venda fiada acima do limite de crédito do cliente. */
  @IsOptional()
  @IsBoolean()
  allowOverCreditLimit?: boolean;

  /** Atendente: autorização do gerente ou dono (e-mail e senha) para passar do limite. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ManagerApprovalDto)
  managerApproval?: ManagerApprovalDto;
}

/**
 * Venda antiga lançada depois (ex.: a internet caiu e a venda foi anotada no papel). Mesmo corpo
 * da venda normal, mais a data e hora em que ela aconteceu. Só gerente e dono.
 */
export class CreateLateSaleDto extends CreateSaleDto {
  /** Data e hora da venda (ISO 8601). Não pode ser no futuro; não há limite para trás. */
  @IsISO8601(
    { strict: true },
    { message: 'Informe a data e a hora em que a venda aconteceu.' },
  )
  soldAt: string;
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

/** Item da comanda: unidades avulsas (`quantity`) e fardos (`packs`), como na venda. */
export class AddCommandItemDto {
  @IsUUID()
  storeProductId: string;

  @IsInt()
  @Min(0, { message: 'A quantidade não pode ser negativa.' })
  @Max(100_000)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'A quantidade de fardos não pode ser negativa.' })
  @Max(10_000)
  packs?: number;
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

  /** Gerente ou dono confirma a venda fiada acima do limite de crédito do cliente. */
  @IsOptional()
  @IsBoolean()
  allowOverCreditLimit?: boolean;

  /** Atendente: autorização do gerente ou dono (e-mail e senha) para passar do limite. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ManagerApprovalDto)
  managerApproval?: ManagerApprovalDto;
}

export class ListCommandTabsQuery {
  @IsOptional()
  @IsEnum({ OPEN: 'OPEN', CLOSED: 'CLOSED' })
  status?: 'OPEN' | 'CLOSED';
}
