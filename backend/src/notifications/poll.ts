/**
 * Enquete nas notificações (decidido pelo usuário, 2026-11-18): qualquer pessoa vota (1 voto por
 * pessoa, que pode mudar até o prazo); quem votou vê o resultado na hora, quem não votou só depois
 * do prazo; a plataforma vê sempre, só os totais. O criador escolhe se aceita várias respostas.
 */
export interface PollOptionView {
  id: string;
  label: string;
  /** null = resultado escondido (a pessoa ainda não votou e a votação está aberta). */
  votes: number | null;
}

export interface PollView {
  endsAt: Date;
  multiple: boolean;
  closed: boolean;
  showResults: boolean;
  /** Quantas pessoas votaram (na escolha múltipla, uma pessoa conta uma vez). */
  totalVoters: number | null;
  /** O que este usuário marcou (vazio = não votou; sempre vazio na plataforma). */
  myOptionIds: string[];
  options: PollOptionView[];
}

export function buildPollView(input: {
  endsAt: Date;
  multiple: boolean;
  options: { id: string; label: string }[];
  counts: Map<string, number>;
  voters: number;
  myOptionIds: string[];
  now: Date;
  /** A plataforma vê o resultado mesmo com a votação aberta. */
  alwaysShowResults?: boolean;
}): PollView {
  const closed = input.now.getTime() >= input.endsAt.getTime();
  const showResults =
    !!input.alwaysShowResults || closed || input.myOptionIds.length > 0;
  return {
    endsAt: input.endsAt,
    multiple: input.multiple,
    closed,
    showResults,
    totalVoters: showResults ? input.voters : null,
    myOptionIds: input.myOptionIds,
    options: input.options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: showResults ? (input.counts.get(o.id) ?? 0) : null,
    })),
  };
}

/** Mesmas opções, na mesma ordem e com o mesmo texto. */
export function samePollOptions(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((label, i) => label === b[i]);
}

/** Opções repetidas (ignorando maiúsculas e espaços nas pontas). */
export function hasDuplicateOptions(options: string[]): boolean {
  const keys = options.map((o) => o.trim().toLocaleLowerCase('pt-BR'));
  return new Set(keys).size !== keys.length;
}
