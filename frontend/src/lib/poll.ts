/**
 * Enquete nas notificações (decidido pelo usuário, 2026-11-18). As regras valem também no backend
 * (`src/notifications/poll.ts` e o service); aqui ficam só as da tela.
 */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;
export const POLL_OPTION_MAX_LENGTH = 100;

/**
 * Porcentagem da opção sobre quem votou. Na escolha múltipla a soma passa de 100%, como no
 * WhatsApp. null = resultado escondido.
 */
export function pollPercent(votes: number | null, totalVoters: number | null): number | null {
  if (votes === null || totalVoters === null) return null;
  if (totalVoters === 0) return 0;
  return Math.round((votes / totalVoters) * 100);
}

/** Próxima escolha ao clicar numa opção: troca na escolha única, marca e desmarca na múltipla. */
export function toggleOption(selected: string[], id: string, multiple: boolean): string[] {
  if (!multiple) return [id];
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

/** Mesma escolha (sem importar a ordem): "Votar" fica apagado se nada mudou. */
export function sameSelection(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** As opções preenchidas do formulário, sem espaços nas pontas. */
export function filledOptions(options: string[]): string[] {
  return options.map((o) => o.trim()).filter((o) => o !== "");
}

/** O que impede salvar a enquete (null = pode salvar). Datas em milissegundos. */
export function pollFormError(input: {
  options: string[];
  endsAt: number | null;
  publishedAt: number | null;
  expiresAt: number | null;
  /** Na criação o prazo precisa estar no futuro; ao editar, dá para encerrar antes. */
  now: number | null;
}): string | null {
  const options = filledOptions(input.options);
  if (options.length < POLL_MIN_OPTIONS)
    return `Preencha pelo menos ${POLL_MIN_OPTIONS} opções.`;
  const keys = options.map((o) => o.toLocaleLowerCase("pt-BR"));
  if (new Set(keys).size !== keys.length) return "As opções não podem se repetir.";
  if (input.endsAt === null) return "Informe o prazo para votar.";
  if (input.now !== null && input.endsAt <= input.now)
    return "O prazo para votar precisa ser no futuro.";
  if (input.publishedAt !== null && input.endsAt <= input.publishedAt)
    return "O prazo para votar precisa ser depois da publicação.";
  if (input.expiresAt !== null && input.expiresAt < input.endsAt)
    return "A notificação não pode expirar antes do fim do prazo para votar.";
  return null;
}
