import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "@/content/duvidas";
import { ArticleView } from "./article-view";

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ id: article.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/duvidas/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getArticle(id)?.title ?? "Dúvidas" };
}

export default async function ArticlePage({ params }: PageProps<"/duvidas/[id]">) {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) notFound();
  return <ArticleView id={article.id} />;
}
