import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { AuthForm } from "@/modules/auth/components/AuthForm";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập vào Tool Lord để dùng các tính năng dành cho tài khoản.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <>
      <SiteNav back={{ href: "/", label: "Công cụ" }} title="Đăng nhập" />
      <main className="page">
        <div className="container auth-page">
          <AuthForm mode="login" />
        </div>
      </main>
    </>
  );
}
