import type { MetadataRoute } from "next";

const siteUrl = "https://gigaxios.com";
const lastModified = new Date("2026-06-13");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
