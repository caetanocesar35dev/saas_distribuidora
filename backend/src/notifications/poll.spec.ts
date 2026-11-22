import { buildPollView, hasDuplicateOptions, samePollOptions } from './poll';

describe('enquete (regras puras)', () => {
  const now = new Date('2026-11-18T12:00:00Z');
  const base = {
    endsAt: new Date('2026-11-20T12:00:00Z'),
    multiple: false,
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    counts: new Map([['a', 3]]),
    voters: 3,
    myOptionIds: [] as string[],
    now,
  };

  it('quem não votou não vê os números enquanto a votação está aberta', () => {
    const view = buildPollView(base);
    expect(view).toMatchObject({
      closed: false,
      showResults: false,
      totalVoters: null,
    });
    expect(view.options.map((o) => o.votes)).toEqual([null, null]);
  });

  it('quem votou vê; opção sem voto aparece com zero', () => {
    const view = buildPollView({ ...base, myOptionIds: ['b'] });
    expect(view.totalVoters).toBe(3);
    expect(view.options.map((o) => o.votes)).toEqual([3, 0]);
  });

  it('no prazo exato a votação fecha e todos veem', () => {
    const view = buildPollView({ ...base, now: base.endsAt });
    expect(view).toMatchObject({ closed: true, showResults: true });
  });

  it('a plataforma vê sempre', () => {
    expect(
      buildPollView({ ...base, alwaysShowResults: true }).showResults,
    ).toBe(true);
  });

  it('compara e encontra opções repetidas', () => {
    expect(samePollOptions(['A', 'B'], ['A', 'B'])).toBe(true);
    expect(samePollOptions(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(hasDuplicateOptions(['Sim', ' SIM'])).toBe(true);
    expect(hasDuplicateOptions(['Sim', 'Não'])).toBe(false);
  });
});
