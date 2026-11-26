import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "@/content/duvidas";
import { isIndexableArticle } from "@/lib/seo";
import { ArticleView } from "./article-view";

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ id: article.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/duvidas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) return { title: "Dúvidas" };
  const path = `/duvidas/${article.id}`;
  return {
    title: article.title,
    description: article.purpose,
    alternates: { canonical: path },
    openGraph: { title: article.title, description: article.purpose, url: path, type: "article" },
    // Os artigos da Plataforma são para a equipe do sistema: abrem, mas não vão para a busca.
    ...(!isIndexableArticle(article) && { robots: { index: false, follow: true } }),
  };
}

export default async function ArticlePage({ params }: PageProps<"/duvidas/[id]">) {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) notFound();
  return <ArticleView id={article.id} />;
}
