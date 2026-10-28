import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLES, CATEGORIES, getArticle, searchArticles } from "./index";

/** Lê todos os arquivos de código do frontend (menos os artigos e os testes). */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "content") continue;
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("Central de Dúvidas", () => {
  it("todo artigo tem id único, categoria válida e as seções obrigatórias", () => {
    const ids = ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    const categories = new Set<string>(CATEGORIES.map((c) => c.id));
    for (const article of ARTICLES) {
      expect(categories.has(article.category), `categoria de ${article.id}`).toBe(true);
      expect(article.title.trim(), `título de ${article.id}`).not.toBe("");
      expect(article.purpose.trim(), `para que serve de ${article.id}`).not.toBe("");
      expect(article.where.trim(), `onde encontrar de ${article.id}`).not.toBe("");
      expect(article.steps.length, `passo a passo de ${article.id}`).toBeGreaterThan(0);
    }
  });

  it("linguagem de balcão: nada de termos técnicos nos textos", () => {
    const forbidden = [
      /\bAPI\b/,
      /\btoken\b/i,
      /\bendpoint\b/i,
      /\bHTTP\b/,
      /\b40[0-9]\b/,
      /\b50[0-9]\b/,
    ];
    for (const article of ARTICLES) {
      const text = [
        article.title,
        article.purpose,
        article.where,
        ...article.steps,
        ...(article.problems ?? []).flatMap((p) => [p.message, p.fix]),
      ].join(" ");
      for (const pattern of forbidden) {
        expect(text, `${article.id} usa "${pattern}"`).not.toMatch(pattern);
      }
    }
  });

  it('todo "veja também" aponta para um artigo que existe', () => {
    for (const article of ARTICLES) {
      for (const related of article.related ?? []) {
        expect(getArticle(related), `${article.id} -> ${related}`).toBeDefined();
      }
    }
  });

  it('todo botão "?" e todo link de ajuda das telas apontam para um artigo que existe', () => {
    const used: [string, string][] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/help="([^"]+)"/g)) used.push([file, match[1]]);
      for (const match of text.matchAll(/\/duvidas\/([a-z0-9-]+)/g)) used.push([file, match[1]]);
    }
    expect(used.length).toBeGreaterThan(10);
    for (const [file, id] of used) {
      expect(getArticle(id), `${file} -> ${id}`).toBeDefined();
    }
  });

  it("cobre os artigos obrigatórios do plano", () => {
    const required = [
      "acesso-entrar",
      "acesso-esqueci-senha",
      "acesso-convite",
      "acesso-trocar-loja",
      "acesso-minha-conta",
      "caixa-abrir",
      "caixa-sangria",
      "caixa-fechar",
      "caixa-anteriores",
      "vendas-vender",
      "vendas-fiado",
      "vendas-vasilhame",
      "vendas-historico",
      "vendas-cancelar",
      "comandas-abrir",
      "comandas-itens",
      "comandas-fechar",
      "comandas-cancelar",
      "produtos-cadastrar",
      "produtos-preco-loja",
      "produtos-colocar-tirar",
      "produtos-entrada",
      "produtos-ajuste",
      "produtos-estoque-baixo",
      "produtos-excluir-reativar",
      "vasilhames-tipos",
      "vasilhames-estoque",
      "vasilhames-fornecedor",
      "vasilhames-cliente",
      "clientes-cadastrar",
      "clientes-fiado",
      "clientes-receber",
      "clientes-pagar-outra-loja",
      "gestao-painel",
      "gestao-historico",
      "gestao-equipe",
      "gestao-lojas",
      "gestao-empresa",
      "gestao-notificacoes",
      "assinatura-teste",
      "assinatura-atraso",
      "assinatura-somente-leitura",
      "assinatura-regularizar",
      "faq-nao-consigo-vender",
      "faq-botao-apagado",
      "faq-vasilhame-outra-loja",
      "faq-cancelei-fiado",
      "faq-excluir-engano",
      "faq-codigo-existe",
      "faq-email",
    ];
    for (const id of required) expect(getArticle(id), id).toBeDefined();
  });

  it("a devolução de vasilhame explica a regra da mesma loja", () => {
    const text = getArticle("vasilhames-cliente")?.steps.join(" ") ?? "";
    expect(text).toMatch(/só abate a dívida da loja onde o cliente levou/);
  });
});

describe("busca da Central de Dúvidas", () => {
  it("ignora acento e maiúsculas", () => {
    const withAccent = searchArticles("devolução", "ALL").map((a) => a.id);
    const without = searchArticles("DEVOLUCAO", "ALL").map((a) => a.id);
    expect(withAccent.length).toBeGreaterThan(0);
    expect(without).toEqual(withAccent);
  });

  it("todas as palavras precisam aparecer", () => {
    const ids = searchArticles("sangria caixa", "ALL").map((a) => a.id);
    expect(ids).toContain("caixa-sangria");
    expect(searchArticles("sangria xyzinexistente", "ALL")).toEqual([]);
  });

  it("o filtro por perfil só vale sem busca na tela, mas a função respeita o perfil pedido", () => {
    const atendente = searchArticles("", "EMPLOYEE").map((a) => a.id);
    expect(atendente).toContain("vendas-vender");
    expect(atendente).not.toContain("gestao-equipe");
    expect(searchArticles("", "ALL").length).toBe(ARTICLES.length);
  });
});
