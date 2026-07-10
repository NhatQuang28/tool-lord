"use client";

/**
 * Client-side page guard by role. Renders `children` only when the signed-in
 * user's role ranks at or above `min`; otherwise shows a friendly panel:
 *   - signed out            → prompt to log in
 *   - signed in, wrong role  → "no permission" notice
 *
 * This is UI-level defense only — every gated API route MUST also enforce with
 * `requireRole` on the server. Renders nothing until the first auth/role
 * resolution to avoid flashing the wrong state.
 */
import Link from "next/link";
import { LogIn, ShieldAlert } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import type { ReactNode } from "react";

export function RoleGate({
  min,
  children,
}: {
  min: Role;
  children: ReactNode;
}) {
  const { user, loading, hasRole } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="role-gate-panel">
        <ShieldAlert size={28} strokeWidth={2} />
        <p>Bạn cần đăng nhập để truy cập trang này.</p>
        <Link href="/login" className="btn primary">
          <LogIn size={17} strokeWidth={2.2} /> Đăng nhập
        </Link>
      </div>
    );
  }

  if (!hasRole(min)) {
    return (
      <div className="role-gate-panel">
        <ShieldAlert size={28} strokeWidth={2} />
        <p>
          Trang này yêu cầu quyền <strong>{ROLE_LABEL[min]}</strong> trở lên. Tài
          khoản của bạn không có quyền truy cập.
        </p>
        <Link href="/" className="btn">
          Về trang chủ
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
