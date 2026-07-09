import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { AuthForm } from "@/modules/auth/components/AuthForm";

export const metadata: Metadata = {
  title: "Đăng ký — Tool Lord",
  description: "Tạo tài khoản Tool Lord để dùng các tính năng dành cho tài khoản.",
};

export default function RegisterPage() {
  return (
    <>
      <SiteNav back={{ href: "/", label: "Công cụ" }} title="Đăng ký" />
      <main className="page">
        <div className="container auth-page">
          <AuthForm mode="register" />
        </div>
      </main>
    </>
  );
}
