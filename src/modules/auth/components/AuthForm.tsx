"use client";

/**
 * Shared email/password form for both the login and register pages.
 * `mode` switches labels, the display-name field, and which auth action runs.
 * On success it redirects home. Also offers Google sign-in.
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { authErrorMessage } from "@/modules/auth/lib/errors";

type Mode = "login" | "register";

const COPY: Record<Mode, { title: string; submit: string; switchText: string; switchHref: string; switchLabel: string }> = {
  login: {
    title: "Đăng nhập",
    submit: "Đăng nhập",
    switchText: "Chưa có tài khoản?",
    switchHref: "/register",
    switchLabel: "Đăng ký",
  },
  register: {
    title: "Đăng ký",
    submit: "Tạo tài khoản",
    switchText: "Đã có tài khoản?",
    switchHref: "/login",
    switchLabel: "Đăng nhập",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const copy = COPY[mode];

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await signUpEmail(email, password, displayName.trim() || undefined);
      } else {
        await signInEmail(email, password);
      }
      router.push("/");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInGoogle();
      router.push("/");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card panel">
      <h1 className="auth-title">{copy.title}</h1>

      <form onSubmit={handleSubmit} noValidate>
        {mode === "register" && (
          <div className="field">
            <label className="field-label" htmlFor="displayName">
              Tên hiển thị (tùy chọn)
            </label>
            <input
              id="displayName"
              type="text"
              className="auth-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              disabled={busy}
            />
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={busy}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            disabled={busy}
          />
        </div>

        {error && (
          <p className="error" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn primary auth-submit"
          disabled={busy}
        >
          {busy && <LoaderCircle size={17} className="spin" />}
          {copy.submit}
        </button>
      </form>

      <div className="auth-divider">
        <span>hoặc</span>
      </div>

      <button
        type="button"
        className="btn auth-google"
        onClick={handleGoogle}
        disabled={busy}
      >
        Tiếp tục với Google
      </button>

      <p className="hint auth-switch">
        {copy.switchText}{" "}
        <Link href={copy.switchHref}>{copy.switchLabel}</Link>
      </p>
    </div>
  );
}
