/**
 * Confere a data e hora de uma venda antiga (valor de `<input type="datetime-local">`). Não há
 * limite para trás (decisão do usuário); só não pode ser no futuro. null = ok.
 */
export function lateSaleDateError(value: string, now: Date = new Date()): string | null {
  if (!value) return "Informe a data e a hora em que a venda aconteceu.";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida.";
  if (date.getTime() > now.getTime()) return "A data da venda não pode ser no futuro.";
  return null;
}
