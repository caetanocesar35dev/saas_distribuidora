/**
 * Celular brasileiro (WhatsApp): DDD + 9 dígitos começando por 9, gravado só com os dígitos
 * (ex.: 81999990000). Aceita máscara na entrada: "(81) 99999-0000".
 */
export const onlyPhoneDigits = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

export const MOBILE_REGEX = /^[1-9]{2}9\d{8}$/;

export const MOBILE_MESSAGE =
  'Informe um celular válido com DDD (ex.: (81) 99999-0000).';
