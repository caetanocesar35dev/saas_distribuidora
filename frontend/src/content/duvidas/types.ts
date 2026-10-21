import type { Role } from "@/lib/api/types";

/** Perfis para quem o artigo é escrito. Cada perfil também pode ler todos os outros. */
export type Audience = Role;

export const CATEGORIES = [
  { id: "acesso", title: "Acesso e conta" },
  { id: "caixa", title: "Caixa" },
  { id: "vendas", title: "Vendas" },
  { id: "comandas", title: "Comandas" },
  { id: "produtos", title: "Produtos e estoque" },
  { id: "vasilhames", title: "Vasilhames" },
  { id: "clientes", title: "Clientes e fiado" },
  { id: "gestao", title: "Gestão da empresa" },
  { id: "assinatura", title: "Assinatura" },
  { id: "perguntas", title: "Perguntas frequentes" },
  { id: "plataforma", title: "Plataforma (equipe do sistema)" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export interface Article {
  /** Identificador usado na URL e pelo botão "?" de cada tela (`/duvidas/<id>`). */
  id: string;
  category: CategoryId;
  title: string;
  /** Para que serve, em uma frase. */
  purpose: string;
  /** O caminho exato no menu. Ex.: "Menu › Caixa › Fechar caixa". */
  where: string;
  steps: string[];
  /**
   * Papel mínimo para fazer o que o artigo ensina. `null` = qualquer pessoa, até sem login.
   * Quando a pessoa tem um papel menor, o artigo mostra "peça ao gerente/dono".
   */
  minRole: Role | null;
  /** Texto próprio para "Quem pode fazer" (ex.: papéis da plataforma, que não são papéis de loja). */
  who?: string;
  /** Para quais perfis o artigo é escrito (define o que aparece primeiro). */
  audience: Audience[];
  /** Mensagens que a pessoa vê na tela e o que fazer. */
  problems?: { message: string; fix: string }[];
  /** Outros artigos relacionados (ids). */
  related?: string[];
  /** Palavras extras para a busca. */
  keywords?: string[];
}
