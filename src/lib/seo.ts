/**
 * Central SEO configuration + helpers.
 *
 * Everything SEO-related derives from here so metadata, sitemap, robots,
 * manifest and structured data stay consistent site-wide. Per-tool metadata is
 * built generically from each `ToolDefinition`, mirroring the tool registry —
 * adding a tool never requires touching SEO plumbing.
 */
import type { Metadata } from "next";
import type { ToolDefinition } from "@/lib/tool";

/** Canonical production origin (no trailing slash). Override per-env. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.toollord.online"
).replace(/\/+$/, "");

export const SITE_NAME = "Tool Lord";
export const SITE_TAGLINE = "Bộ công cụ web nhanh, gọn, riêng tư";
export const SITE_DESCRIPTION =
  "Bộ sưu tập công cụ web nhỏ gọn chạy ngay trong trình duyệt: mã hóa tin nhắn, gõ mõ tích phúc, chia sẻ ảnh bí mật mã hóa đầu-cuối và nhiều hơn nữa. Miễn phí, không cần đăng ký, không quảng cáo, tôn trọng quyền riêng tư.";

/** BCP-47 for <html lang>; OG uses the underscored variant. */
export const SITE_LANG = "vi";
export const OG_LOCALE = "vi_VN";

export const DEFAULT_KEYWORDS = [
  "công cụ web",
  "công cụ online miễn phí",
  "tool online",
  "mã hóa tin nhắn",
  "gõ mõ online",
  "chia sẻ ảnh bí mật",
  "mã hóa đầu cuối",
  "bảo mật",
  "riêng tư",
  "Tool Lord",
];

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Site-relative path for a tool's page. */
export function toolPath(tool: ToolDefinition): string {
  return `/tools/${tool.slug}`;
}

/**
 * Rich metadata for a single tool page. The root layout supplies the title
 * template, OG image, robots, etc.; this fills in the per-tool specifics.
 */
export function toolMetadata(tool: ToolDefinition): Metadata {
  const path = toolPath(tool);
  const title = `${tool.name} — ${SITE_NAME}`;
  return {
    title: tool.name,
    description: tool.description,
    keywords: [tool.name, tool.category ?? "", ...DEFAULT_KEYWORDS].filter(
      Boolean,
    ) as string[],
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      title,
      description: tool.description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tool.description,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* JSON-LD structured data                                                    */
/* -------------------------------------------------------------------------- */

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    description: SITE_DESCRIPTION,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
    url: SITE_URL,
    inLanguage: SITE_LANG,
    description: SITE_DESCRIPTION,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

/** An ItemList of all tools — used on the home page. */
export function toolsItemListJsonLd(tools: ToolDefinition[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Công cụ ${SITE_NAME}`,
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(toolPath(tool)),
      name: tool.name,
    })),
  };
}

/** SoftwareApplication for a single tool page. */
export function softwareAppJsonLd(tool: ToolDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description,
    url: absoluteUrl(toolPath(tool)),
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    inLanguage: SITE_LANG,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "VND" },
    provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

/** Breadcrumb Trang chủ → Tool for a tool page. */
export function toolBreadcrumbJsonLd(tool: ToolDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: tool.name,
        item: absoluteUrl(toolPath(tool)),
      },
    ],
  };
}
