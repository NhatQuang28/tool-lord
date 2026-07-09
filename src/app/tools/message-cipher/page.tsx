import type { Metadata } from "next";
import { messageCipherTool } from "@/modules/message-cipher/config";
import { MessageCipherTool } from "@/modules/message-cipher/components/MessageCipherTool";
import { SiteNav } from "@/components/SiteNav";
import { ToolHeader } from "@/components/ToolHeader";
import { JsonLd } from "@/components/JsonLd";
import {
  toolMetadata,
  softwareAppJsonLd,
  toolBreadcrumbJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = toolMetadata(messageCipherTool);

export default function MessageCipherPage() {
  return (
    <>
      <JsonLd
        data={[
          softwareAppJsonLd(messageCipherTool),
          toolBreadcrumbJsonLd(messageCipherTool),
        ]}
      />
      <SiteNav
        back={{ href: "/", label: "Công cụ" }}
        title={messageCipherTool.name}
      />
      <main className="page">
        <div className="container">
          <ToolHeader tool={messageCipherTool} />
          <MessageCipherTool />
        </div>
      </main>
    </>
  );
}
