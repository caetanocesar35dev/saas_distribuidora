import { acesso } from "./acesso";
import { assinatura } from "./assinatura";
import { caixa } from "./caixa";
import { clientes } from "./clientes";
import { comandas } from "./comandas";
import { gestao } from "./gestao";
import { perguntas } from "./perguntas";
import { plataforma } from "./plataforma";
import { produtos } from "./produtos";
import { CATEGORIES, type Article, type Audience, type CategoryId } from "./types";
import { vasilhames } from "./vasilhames";
import { vendas } from "./vendas";

export { CATEGORIES };
export type { Article, Audience, CategoryId };

/**
 * Todos os artigos da Central de Dúvidas. Conteúdo estático, versionado junto com o código: a cada
 * tela criada ou alterada, o artigo dela é criado ou atualizado (regra do projeto).
 */
export const ARTICLES: Article[] = [
  ...acesso,
  ...caixa,
  ...vendas,
  ...comandas,
  ...produtos,
  ...vasilhames,
  ...clientes,
  ...gestao,
  ...assinatura,
  ...perguntas,
  ...plataforma,
];

const byId = new Map(ARTICLES.map((a) => [a.id, a]));

export function getArticle(id: string): Article | undefined {
  return byId.get(id);
}

/** Minúsculas e sem acento, para a busca ignorar diferenças de digitação. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function searchableText(article: Article): string {
  return normalize(
    [
      article.title,
      article.purpose,
      article.where,
      ...article.steps,
      ...(article.problems ?? []).flatMap((p) => [p.message, p.fix]),
      ...(article.keywords ?? []),
    ].join(" "),
  );
}

const index = new Map(ARTICLES.map((a) => [a.id, searchableText(a)]));

export function searchArticles(query: string, audience: Audience | "ALL"): Article[] {
  const terms = normalize(query)
    .split(/\s+/)
    .filter(Boolean);
  return ARTICLES.filter((article) => {
    if (audience !== "ALL" && !article.audience.includes(audience)) return false;
    const text = index.get(article.id) ?? "";
    return terms.every((term) => text.includes(term));
  });
}
