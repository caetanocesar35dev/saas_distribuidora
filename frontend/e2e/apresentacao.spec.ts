import { expect, test } from "@playwright/test";
import { trackPageErrors } from "./helpers";
import { STATE } from "./session";

test.describe("página de apresentação", () => {
  test("abre sem login, com planos pagos, cadastro e canais de contato", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // o Trial é só do período de teste: não aparece na vitrine
    const planos = page.locator("#planos");
    await expect(planos.getByRole("heading", { name: "Essencial" })).toBeVisible();
    await expect(planos.getByRole("heading", { name: "Trial" })).toHaveCount(0);

    await expect(page.getByRole("link", { name: "Falar no WhatsApp" }).first()).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/5531975623307\?text=/,
    );
    await expect(page.getByRole("link", { name: "Instagram" }).first()).toHaveAttribute(
      "href",
      "https://www.instagram.com/minhadistribuidoraonline_/",
    );

    await page.getByRole("link", { name: /Testar grátis por 14 dias/ }).click();
    await expect(page).toHaveURL(/\/cadastro$/);
    expect(errors).toEqual([]);
  });

  test("quem já está logado vai direto para o sistema", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STATE.dono });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).not.toHaveURL(/localhost:\d+\/$/);
    await context.close();
  });

  test("a Central de Dúvidas mostra os canais de contato", async ({ page }) => {
    await page.goto("/duvidas");
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/5531975623307/,
    );
    await page.goto("/duvidas/faq-falar-com-suporte");
    await expect(page.getByRole("link", { name: /Instagram/ })).toHaveAttribute(
      "href",
      "https://www.instagram.com/minhadistribuidoraonline_/",
    );
  });
});

test.describe("buscadores (SEO)", () => {
  test("robots.txt, sitemap e imagem de compartilhamento abrem sem login", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const rules = await robots.text();
    expect(rules).toContain("Disallow: /loja/");
    expect(rules).toMatch(/Sitemap: .*\/sitemap\.xml/);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const xml = await sitemap.text();
    expect(xml).toContain("/duvidas/faq-falar-com-suporte</loc>");
    expect(xml).not.toContain("/loja/");

    // sem sessão, o proxy não pode mandar a imagem para o login
    const image = await request.get("/opengraph-image", { maxRedirects: 0 });
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  });

  test("a apresentação e os artigos têm descrição, endereço canônico e dados estruturados", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /distribuidoras/);
    // o endereço da página inicial é o próprio site (SITE_URL), com ou sem a barra
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https?:\/\/[^/]+\/?$/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
    const ld = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    ) as { "@graph": { "@type": string }[] };
    expect(ld["@graph"].map((n) => n["@type"])).toEqual(
      expect.arrayContaining(["Organization", "SoftwareApplication", "FAQPage"]),
    );

    await page.goto("/cadastro?ref=QUALQUER");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/cadastro$/);

    await page.goto("/duvidas/faq-falar-com-suporte");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/duvidas\/faq-falar-com-suporte$/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});
