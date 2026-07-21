import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://noopy-portfolio.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE, lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
