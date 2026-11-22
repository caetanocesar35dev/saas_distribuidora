import type { MetadataRoute } from "next";
import { ARTICLES } from "@/content/duvidas";
import { sitemapPaths, siteUrl } from "@/lib/seo";

// Sem `lastModified`: o Google só usa a data quando ela é exata, e o conteúdo vem do código.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return sitemapPaths(ARTICLES).map((path) => ({ url: path === "/" ? base : `${base}${path}` }));
}
