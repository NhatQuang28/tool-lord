import type { Metadata } from "next";
import { secretImageTool } from "@/modules/secret-image/config";
import { SecretImageTool } from "@/modules/secret-image/components/SecretImageTool";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: `${secretImageTool.name} — Tool Lord`,
  description: secretImageTool.description,
};

export default function SecretImagePage() {
  return (
    <>
      <SiteNav back={{ href: "/", label: "Công cụ" }} title={secretImageTool.name} />
      <main className="page">
        <div className="container" style={{ paddingTop: "var(--space-6)" }}>
          <SecretImageTool />
        </div>
      </main>
    </>
  );
}
