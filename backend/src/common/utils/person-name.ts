/**
 * Nome de pessoa (usuário, convidado): só letras (com acento, de qualquer idioma), espaço,
 * apóstrofo, hífen e ponto. Números e outros símbolos não entram. Começa com letra.
 * (Nome de loja, empresa e produto PODE ter número: esta regra não vale para eles.)
 */
export const PERSON_NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;

export const PERSON_NAME_MESSAGE =
  'O nome deve ter só letras (sem números ou símbolos).';

export const isValidPersonName = (value: string) =>
  PERSON_NAME_REGEX.test(value.trim());
