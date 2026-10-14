import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Role } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// ---- Company -----------------------------------------------------------------------------

export class CreateCompanyDto {
  @IsString()
  @Length(14, 18, { message: 'CNPJ inválido.' })
  cnpj: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  razaoSocial: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome da primeira loja é obrigatório.' })
  @MaxLength(120)
  storeName: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  razaoSocial?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string;
}

// ---- Store ---------------------------------------------------------------------------------

export class CreateStoreDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional() @IsString() @MaxLength(18) cnpj?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(9) zipCode?: string;
  @IsOptional() @IsString() @MaxLength(200) street?: string;
  @IsOptional() @IsString() @MaxLength(20) number?: string;
  @IsOptional() @IsString() @MaxLength(100) complement?: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 letras (UF).' })
  state?: string;
}

export class UpdateStoreDto extends PartialType(CreateStoreDto) {}

// ---- Membros ---------------------------------------------------------------------------------

export class StoreRoleDto {
  @IsUUID()
  storeId: string;

  @IsEnum(Role)
  role: Role;
}

export class InviteMemberDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma loja.' })
  @ValidateNested({ each: true })
  @Type(() => StoreRoleDto)
  stores: StoreRoleDto[];
}

export class SetRoleDto {
  @IsEnum(Role)
  role: Role;
}
