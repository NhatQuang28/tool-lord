import type { Metadata } from "next";
import { messageCipherTool } from "@/modules/message-cipher/config";
import { MessageCipherTool } from "@/modules/message-cipher/components/MessageCipherTool";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: `${messageCipherTool.name} — Tool Lord`,
  description: messageCipherTool.description,
};

export default function MessageCipherPage() {
  return (
    <>
      <SiteNav
        back={{ href: "/", label: "Công cụ" }}
        title={messageCipherTool.name}
      />
      <main className="page">
        <div className="container" style={{ paddingTop: "var(--space-6)" }}>
          <MessageCipherTool />
        </div>
      </main>
    </>
  );
}
