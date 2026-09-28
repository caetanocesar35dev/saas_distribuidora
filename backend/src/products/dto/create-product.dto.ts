import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome do produto é obrigatório' })
  name: string;

  @IsNumber()
  @Min(0, { message: 'O preço não pode ser negativo' })
  price: number;

  @IsNumber()
  @Min(0, { message: 'O preço de custo não pode ser negativo' })
  costPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'O estoque não pode ser negativo' })
  stock?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'A quantidade por fardo/engradado deve ser no mínimo 1' })
  packQuantity?: number;

  @IsOptional()
  @IsNumber()
  bottleTypeId?: number | null;
}
