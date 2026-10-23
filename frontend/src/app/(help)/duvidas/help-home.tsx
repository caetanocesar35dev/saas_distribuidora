"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/app/common";
import { Input } from "@/components/ui/input";
import { CATEGORIES, searchArticles, type Audience } from "@/content/duvidas";
import { ROLE_LABEL } from "@/lib/format";
import { useHelpViewer } from "@/lib/help/viewer";
import { cn } from "@/lib/utils";

type Filter = Audience | "ALL";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "EMPLOYEE", label: ROLE_LABEL.EMPLOYEE },
  { value: "MANAGER", label: ROLE_LABEL.MANAGER },
  { value: "OWNER", label: ROLE_LABEL.OWNER },
  { value: "ALL", label: "Todos" },
];

export function HelpHome() {
  const viewer = useHelpViewer();
  const [query, setQuery] = useState("");
  // Abre nos artigos do papel da pessoa; ela pode trocar o filtro e ver todos.
  const [chosen, setChosen] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? viewer.role ?? "ALL";

  // Buscando, procura em todos os perfis (o filtro só organiza a lista quando não há busca).
  const searching = query.trim() !== "";
  const results = searchArticles(query, searching ? "ALL" : filter);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dúvidas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Aprenda a usar cada parte do sistema e descubra onde ela fica no menu.
      </p>

      <div className="relative mt-5">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busque por uma palavra: caixa, fiado, senha, vasilhame..."
          className="h-10 pl-9"
          aria-label="Buscar nas dúvidas"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Artigos para:</span>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setChosen(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {results.length === 0 && (
          <EmptyState
            title="Nenhum artigo encontrado"
            description={`Tente outra palavra ou escolha "Todos" nos perfis.`}
          />
        )}
        {CATEGORIES.map((category) => {
          const articles = results.filter((a) => a.category === category.id);
          if (articles.length === 0) return null;
          return (
            <section key={category.id}>
              <h2 className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {category.title}
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {articles.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/duvidas/${article.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <p className="font-medium">{article.title}</p>
                      <p className="text-sm text-muted-foreground">{article.purpose}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
