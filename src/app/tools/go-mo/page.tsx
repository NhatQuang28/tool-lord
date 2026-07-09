import type { Metadata } from "next";
import { woodenFishTool } from "@/modules/wooden-fish/config";
import { WoodenFishTool } from "@/modules/wooden-fish/components/WoodenFishTool";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: `${woodenFishTool.name} — Tool Lord`,
  description: woodenFishTool.description,
};

export default function WoodenFishPage() {
  return (
    <>
      <SiteNav back={{ href: "/", label: "Công cụ" }} title={woodenFishTool.name} />
      <main className="page">
        <div className="container" style={{ paddingTop: "var(--space-6)" }}>
          <WoodenFishTool />
        </div>
      </main>
    </>
  );
}
