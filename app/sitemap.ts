import type { MetadataRoute } from "next";
import { blogPosts, getPostUrl } from "@/app/lib/blogPosts";

const siteUrl = "https://gigaxios.com";
const lastModified = new Date("2026-06-13");

export default function sitemap(): MetadataRoute.Sitemap {
  const blogRoutes = [
    {
      url: `${siteUrl}/blog`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...blogPosts.map((post) => ({
      url: getPostUrl(post.slug),
      lastModified: new Date(post.updatedDate ?? post.publishDate),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

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
    ...blogRoutes,
  ];
}
