/**
 * Formatos aceitos no endereço e no telefone de loja (com ou sem máscara):
 *  - telefone fixo ou celular com DDD: "(81) 3333-4444", "81999990000";
 *  - CEP com 8 dígitos: "50030-230" ou "50030230".
 */
export const PHONE_REGEX = /^\(?[1-9]{2}\)?\s?(?:[2-8]\d{3}|9\d{4})-?\d{4}$/;
export const PHONE_MESSAGE =
  'Telefone inválido: use DDD + número (fixo ou celular).';

export const ZIP_REGEX = /^\d{5}-?\d{3}$/;
export const ZIP_MESSAGE = 'CEP inválido: use 8 números (00000-000).';
