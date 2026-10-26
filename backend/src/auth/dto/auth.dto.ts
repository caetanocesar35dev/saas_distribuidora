import { Transform, Type } from 'class-transformer';
import {
  MOBILE_MESSAGE,
  MOBILE_REGEX,
  onlyPhoneDigits,
} from '../../common/utils/phone';
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
import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Mesmos campos e limites do endereço em `CreateStoreDto`. */
export class SignupStoreAddressDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(9)
  @Matches(ZIP_REGEX, { message: ZIP_MESSAGE })
  zipCode?: string;
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
  @Matches(/^[A-Za-z]{2}$/, { message: 'O estado deve ter 2 letras (UF).' })
  state?: string;
}

export class SignupDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MaxLength(120)
  @Matches(PERSON_NAME_REGEX, { message: PERSON_NAME_MESSAGE })
  name: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(72)
  password: string;

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
  @IsNotEmpty({ message: 'O nome da loja é obrigatório.' })
  @MaxLength(120)
  storeName: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  /** Aceite dos termos de uso e da política de privacidade (LGPD): obrigatório. */
  @Equals(true, {
    message: 'É preciso aceitar os termos de uso e a política de privacidade.',
  })
  acceptTerms: boolean;

  /** Celular (WhatsApp) do dono: obrigatório (decisão do usuário). Grava só os dígitos. */
  @Transform(({ value }) => onlyPhoneDigits(value))
  @IsString({ message: MOBILE_MESSAGE })
  @Matches(MOBILE_REGEX, { message: MOBILE_MESSAGE })
  phone: string;

  /**
   * Endereço e telefone da primeira loja, opcionais. A tela preenche com o que a consulta pública
   * do CNPJ devolveu (o dono não digita nada a mais); o dono confere depois em Lojas.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => SignupStoreAddressDto)
  storeAddress?: SignupStoreAddressDto;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken: string;
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(72)
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(72)
  newPassword: string;
}

export class UpdateProfileDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(PERSON_NAME_REGEX, { message: PERSON_NAME_MESSAGE })
  name: string;

  /** Celular (WhatsApp). Texto vazio apaga; ausente não mexe. */
  @IsOptional()
  @Transform(({ value }) => onlyPhoneDigits(value))
  @IsString()
  @Matches(/^$|^[1-9]{2}9\d{8}$/, { message: MOBILE_MESSAGE })
  phone?: string;
}
