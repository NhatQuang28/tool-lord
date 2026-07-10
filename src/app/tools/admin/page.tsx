import type { Metadata } from "next";
import { adminTool } from "@/modules/admin/config";
import { AdminPanel } from "@/modules/admin/components/AdminPanel";
import { RoleGate } from "@/modules/auth/components/RoleGate";
import { SiteNav } from "@/components/SiteNav";
import { ToolHeader } from "@/components/ToolHeader";

// Admin-only surface: not indexed, no structured data (unlike public tools).
export const metadata: Metadata = {
  title: adminTool.name,
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <SiteNav back={{ href: "/", label: "Công cụ" }} title={adminTool.name} />
      <main className="page">
        <div className="container">
          <ToolHeader tool={adminTool} />
          <RoleGate min="admin">
            <AdminPanel />
          </RoleGate>
        </div>
      </main>
    </>
  );
}
