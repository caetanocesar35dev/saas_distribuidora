import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${base}/sitemap.xml`,
  };
}
