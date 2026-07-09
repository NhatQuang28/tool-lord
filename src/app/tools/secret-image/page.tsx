import type { Metadata } from "next";
import { secretImageTool } from "@/modules/secret-image/config";
import { SecretImageTool } from "@/modules/secret-image/components/SecretImageTool";
import { SiteNav } from "@/components/SiteNav";
import { ToolHeader } from "@/components/ToolHeader";
import { JsonLd } from "@/components/JsonLd";
import {
  toolMetadata,
  softwareAppJsonLd,
  toolBreadcrumbJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = toolMetadata(secretImageTool);

export default function SecretImagePage() {
  return (
    <>
      <JsonLd
        data={[
          softwareAppJsonLd(secretImageTool),
          toolBreadcrumbJsonLd(secretImageTool),
        ]}
      />
      <SiteNav back={{ href: "/", label: "Công cụ" }} title={secretImageTool.name} />
      <main className="page">
        <div className="container">
          <ToolHeader tool={secretImageTool} />
          <SecretImageTool />
        </div>
      </main>
    </>
  );
}
