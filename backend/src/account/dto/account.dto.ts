import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  PERSON_NAME_MESSAGE,
  PERSON_NAME_REGEX,
} from '../../common/utils/person-name';
import {
  PHONE_MESSAGE,
  PHONE_REGEX,
  ZIP_MESSAGE,
  ZIP_REGEX,
} from '../../common/utils/address';
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
  Matches,
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
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;
  // Endereço obrigatório ao criar a loja, menos o complemento (decisão do usuário). Na edição
  // (`UpdateStoreDto`) os campos podem faltar, mas não podem vir vazios.
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe o CEP.' })
  @MaxLength(9)
  @Matches(ZIP_REGEX, { message: ZIP_MESSAGE })
  zipCode: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe a rua.' })
  @MaxLength(200)
  street: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe o número (ou S/N).' })
  @MaxLength(20)
  number: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  complement?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe o bairro.' })
  @MaxLength(100)
  neighborhood: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe a cidade.' })
  @MaxLength(100)
  city: string;

  @Transform(trim)
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 letras (UF).' })
  state: string;
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
  @Matches(PERSON_NAME_REGEX, { message: PERSON_NAME_MESSAGE })
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
