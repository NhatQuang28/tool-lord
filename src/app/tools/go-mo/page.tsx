import type { Metadata } from "next";
import { woodenFishTool } from "@/modules/wooden-fish/config";
import { WoodenFishTool } from "@/modules/wooden-fish/components/WoodenFishTool";
import { SiteNav } from "@/components/SiteNav";
import { JsonLd } from "@/components/JsonLd";
import {
  toolMetadata,
  softwareAppJsonLd,
  toolBreadcrumbJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = toolMetadata(woodenFishTool);

export default function WoodenFishPage() {
  return (
    <>
      <JsonLd
        data={[
          softwareAppJsonLd(woodenFishTool),
          toolBreadcrumbJsonLd(woodenFishTool),
        ]}
      />
      <SiteNav back={{ href: "/", label: "Công cụ" }} title={woodenFishTool.name} />
      <main className="page">
        {/* Immersive full-screen tool — keep the H1 for SEO without cluttering UI. */}
        <h1 className="sr-only">{woodenFishTool.name} — gõ mõ online tích công đức</h1>
        <div className="container" style={{ paddingTop: "var(--space-6)" }}>
          <WoodenFishTool />
        </div>
      </main>
    </>
  );
}
