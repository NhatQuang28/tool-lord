import type { MetadataRoute } from "next";
import { listedTools } from "@/modules/registry";
import { SITE_URL, toolPath } from "@/lib/seo";

/**
 * Generated sitemap. Static pages + every enabled tool (derived from the
 * registry, so new tools appear automatically). The encrypted-album viewer
 * (/tools/secret-image/v/*) is per-user and intentionally excluded / noindexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const toolRoutes: MetadataRoute.Sitemap = listedTools.map((tool) => ({
    url: `${SITE_URL}${toolPath(tool)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...toolRoutes];
}
