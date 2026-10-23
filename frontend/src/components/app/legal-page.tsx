import { TERMS_UPDATED_AT, type LegalSection } from "@/content/legal";

/** Página de texto legal (termos de uso, política de privacidade). */
export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <article className="space-y-6 rounded-xl border bg-card p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Versão de {TERMS_UPDATED_AT}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="font-semibold">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
