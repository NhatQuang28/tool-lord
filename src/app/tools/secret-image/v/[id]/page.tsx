import type { Metadata } from "next";
import { secretImageTool } from "@/modules/secret-image/config";
import { SecretImageViewer } from "@/modules/secret-image/components/SecretImageViewer";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: `Album bí mật — ${secretImageTool.name}`,
  description: "Xem album ảnh được mã hóa đầu-cuối.",
  robots: { index: false, follow: false },
};

export default async function SecretImageViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <SiteNav
        back={{ href: "/tools/secret-image", label: secretImageTool.name }}
        title="Album bí mật"
      />
      <main className="page">
        <div className="container" style={{ paddingTop: "var(--space-6)" }}>
          <SecretImageViewer id={id} />
        </div>
      </main>
    </>
  );
}
