"use client";

/**
 * Nav affordance for auth: a "Đăng nhập" link when signed out, or the user's
 * name plus a logout button when signed in. Renders nothing until the first
 * auth-state resolution to avoid flashing the wrong state.
 */
import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";

export function AuthMenu() {
  const { user, loading, logout } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login" className="btn small auth-nav-login">
        <LogIn size={16} />
        Đăng nhập
      </Link>
    );
  }

  const label = user.displayName || user.email || "Tài khoản";

  return (
    <div className="auth-nav-user">
      <span className="auth-nav-name" title={label}>
        {label}
      </span>
      <button
        type="button"
        className="icon-btn"
        onClick={() => logout()}
        aria-label="Đăng xuất"
        title="Đăng xuất"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}
