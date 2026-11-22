import type { Article } from "@/content/duvidas";
import type { Plan } from "@/lib/api/types";

/**
 * SEO: o que os buscadores podem ler. Só as páginas públicas (apresentação, cadastro, Central de
 * Dúvidas, termos e privacidade) entram no sitemap; a área logada fica fora do robots.txt.
 */
export const SITE_NAME = "Minha Distribuidora Online";

export const SITE_DESCRIPTION =
  "Sistema feito para distribuidoras e depósitos de bebidas: PDV, caixa, estoque, comandas, controle de vasilhame e fiado, em uma ou várias lojas. Teste grátis por 14 dias, sem cartão.";

/**
 * Endereço público do site (ex.: https://www.minhadistribuidoraonline.com.br), da variável
 * `SITE_URL` do servidor. Precisa existir também no `npm run build`, porque as páginas públicas,
 * o robots.txt e o sitemap são montados no build.
 */
export function siteUrl(value: string | undefined = process.env.SITE_URL): string {
  const url = (value ?? "").trim().replace(/\/+$/, "");
  return url || "http://localhost:3000";
}

/** Área logada e telas de uso único: os buscadores não entram (o proxy mandaria para o login). */
export const PRIVATE_PATHS = [
  "/api/",
  "/loja/",
  "/empresa/",
  "/plataforma",
  "/selecionar",
  "/conta",
  "/indique",
  "/notificacoes",
  "/redefinir-senha",
  "/esqueci-a-senha",
];

/** Os artigos da Plataforma ensinam a equipe do sistema: ficam fora da busca do Google. */
export function isIndexableArticle(article: Pick<Article, "category">): boolean {
  return article.category !== "plataforma";
}

/** Caminhos do sitemap, do mais importante para o menos. */
export function sitemapPaths(articles: Pick<Article, "id" | "category">[]): string[] {
  return [
    "/",
    "/cadastro",
    "/duvidas",
    ...articles.filter(isIndexableArticle).map((a) => `/duvidas/${a.id}`),
    "/termos",
    "/privacidade",
  ];
}

/** JSON-LD pronto para `<script type="application/ld+json">`, sem deixar fechar a tag. */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Dados estruturados da página de apresentação (schema.org): a empresa, o sistema com o preço de
 * cada plano e as perguntas frequentes. Ajudam o Google a entender o que é o site.
 */
export function landingStructuredData(input: {
  url: string;
  plans: Pick<Plan, "name" | "priceInCents">[];
  faq: { question: string; answer: string }[];
  sameAs: string[];
}): object {
  const organizationId = `${input.url}/#organizacao`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE_NAME,
        url: input.url,
        sameAs: input.sameAs,
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: input.url,
        description: SITE_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "pt-BR",
        publisher: { "@id": organizationId },
        ...(input.plans.length > 0 && {
          offers: input.plans.map((plan) => ({
            "@type": "Offer",
            name: plan.name,
            price: (plan.priceInCents / 100).toFixed(2),
            priceCurrency: "BRL",
          })),
        }),
      },
      {
        "@type": "FAQPage",
        mainEntity: input.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}
