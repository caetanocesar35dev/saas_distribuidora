"use client";

import { ArrowLeftIcon, MapPinIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, getArticle } from "@/content/duvidas";
import { hasMinRole, ROLE_LABEL } from "@/lib/format";
import { useHelpViewer } from "@/lib/help/viewer";

function whoCan(minRole: "OWNER" | "MANAGER" | "EMPLOYEE" | null): string {
  if (minRole === null) return "Qualquer pessoa";
  if (minRole === "EMPLOYEE") return "Atendente, gerente e dono";
  if (minRole === "MANAGER") return "Gerente e dono";
  return "Somente o dono";
}

export function ArticleView({ id }: { id: string }) {
  const article = getArticle(id);
  const viewer = useHelpViewer();
  if (!article) notFound();

  const category = CATEGORIES.find((c) => c.id === article.category);
  const blocked =
    article.minRole !== null && viewer.role !== null && !hasMinRole(viewer.role, article.minRole);

  return (
    <article>
      <Link
        href="/duvidas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" /> Todas as dúvidas
      </Link>

      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {category?.title}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{article.title}</h1>

      {blocked && article.minRole && (
        <div className="mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            Você entra como {viewer.role ? ROLE_LABEL[viewer.role].toLowerCase() : "atendente"}, e
            isto é feito por {ROLE_LABEL[article.minRole].toLowerCase()} ou acima. Peça{" "}
            {article.minRole === "OWNER" ? "ao dono" : "ao gerente"}.
          </p>
        </div>
      )}

      <section className="mt-5 space-y-5 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Para que serve</h2>
          <p className="mt-1 text-sm text-muted-foreground">{article.purpose}</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Onde encontrar</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
            <MapPinIcon className="size-4" /> {article.where}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Passo a passo</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {article.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Quem pode fazer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {article.who ?? whoCan(article.minRole)}
          </p>
        </div>

        {article.problems && article.problems.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold">Problemas comuns</h2>
            <ul className="mt-2 space-y-3">
              {article.problems.map((problem) => (
                <li key={problem.message} className="rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="font-medium">“{problem.message}”</p>
                  <p className="mt-1 text-muted-foreground">{problem.fix}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {article.related && article.related.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Veja também</h2>
          <ul className="space-y-1 text-sm">
            {article.related.map((relatedId) => {
              const related = getArticle(relatedId);
              if (!related) return null;
              return (
                <li key={relatedId}>
                  <Link href={`/duvidas/${relatedId}`} className="text-primary hover:underline">
                    {related.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
