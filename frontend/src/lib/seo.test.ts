import { describe, expect, it } from "vitest";
import { ARTICLES } from "@/content/duvidas";
import {
  isIndexableArticle,
  jsonLd,
  landingStructuredData,
  PRIVATE_PATHS,
  sitemapPaths,
  siteUrl,
} from "./seo";

describe("siteUrl", () => {
  it("usa SITE_URL sem a barra do fim", () => {
    expect(siteUrl("https://www.exemplo.com.br/")).toBe("https://www.exemplo.com.br");
    expect(siteUrl("  https://exemplo.com.br  ")).toBe("https://exemplo.com.br");
  });

  it("sem valor, cai no endereço local", () => {
    expect(siteUrl(undefined)).toBe("http://localhost:3000");
    expect(siteUrl("")).toBe("http://localhost:3000");
  });
});

describe("sitemap", () => {
  const paths = sitemapPaths(ARTICLES);

  it("tem a apresentação, o cadastro, a Central de Dúvidas e as páginas legais", () => {
    expect(paths[0]).toBe("/");
    expect(paths).toEqual(
      expect.arrayContaining(["/cadastro", "/duvidas", "/termos", "/privacidade"]),
    );
  });

  it("tem os artigos, menos os da Plataforma", () => {
    const article = ARTICLES.find((a) => a.category === "vendas")!;
    expect(paths).toContain(`/duvidas/${article.id}`);
    for (const a of ARTICLES.filter((a) => a.category === "plataforma")) {
      expect(isIndexableArticle(a)).toBe(false);
      expect(paths).not.toContain(`/duvidas/${a.id}`);
    }
  });

  it("não lista nada que o robots.txt bloqueia", () => {
    for (const path of paths) {
      expect(PRIVATE_PATHS.some((p) => path.startsWith(p))).toBe(false);
    }
  });

  it("o robots.txt bloqueia a área logada", () => {
    expect(PRIVATE_PATHS).toEqual(
      expect.arrayContaining(["/loja/", "/empresa/", "/plataforma", "/api/", "/redefinir-senha"]),
    );
  });
});

describe("dados estruturados", () => {
  const data = landingStructuredData({
    url: "https://exemplo.com.br",
    plans: [{ name: "Essencial", priceInCents: 9900 }],
    faq: [{ question: "Funciona sem internet?", answer: "Não." }],
    sameAs: ["https://www.instagram.com/x/"],
  }) as { "@graph": Record<string, unknown>[] };

  it("traz o preço dos planos em reais e as perguntas", () => {
    const app = data["@graph"].find((n) => n["@type"] === "SoftwareApplication")!;
    expect(app.offers).toEqual([
      { "@type": "Offer", name: "Essencial", price: "99.00", priceCurrency: "BRL" },
    ]);
    const faq = data["@graph"].find((n) => n["@type"] === "FAQPage")!;
    expect(faq.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "Funciona sem internet?",
        acceptedAnswer: { "@type": "Answer", text: "Não." },
      },
    ]);
  });

  it("sem planos (backend fora do ar), não inventa oferta", () => {
    const empty = landingStructuredData({ url: "x", plans: [], faq: [], sameAs: [] }) as {
      "@graph": Record<string, unknown>[];
    };
    const app = empty["@graph"].find((n) => n["@type"] === "SoftwareApplication")!;
    expect(app).not.toHaveProperty("offers");
  });

  it("o JSON não consegue fechar a tag <script>", () => {
    const text = jsonLd({ a: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ a: "</script><script>alert(1)</script>" });
  });
});
