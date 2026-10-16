import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

export class OpenCashRegisterDto {
  @IsNumber(MONEY)
  @Min(0, { message: 'O saldo inicial não pode ser negativo.' })
  @Max(100_000_000)
  initialBalance: number;
}

/** Movimentação manual. O tipo SALE nasce das vendas e não é aceito aqui. */
export class CashMovementDto {
  @IsIn(['IN', 'OUT'], {
    message: 'O tipo deve ser IN (entrada) ou OUT (saída).',
  })
  type: 'IN' | 'OUT';

  @IsNumber(MONEY)
  @Min(0.01, { message: 'O valor da movimentação deve ser maior que zero.' })
  @Max(100_000_000)
  amount: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description?: string;
}
