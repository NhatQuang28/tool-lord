"use client";

/**
 * App-wide auth state + actions, backed by the Firebase client SDK.
 *
 * Wrap the app once (in `layout.tsx`) and read state anywhere with `useAuth()`.
 * `onAuthStateChanged` keeps `user` in sync across tabs, refresh, and sign-in/out.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { DEFAULT_ROLE, hasAtLeast, isRole, type Role } from "@/lib/roles";

interface AuthContextValue {
  /** Signed-in user, or null when signed out. */
  user: User | null;
  /**
   * Effective role of the signed-in user, read from the `role` custom claim on
   * the ID token. `DEFAULT_ROLE` ("user") while signed out or before the token
   * resolves. The server remains the source of truth — this is for UI only.
   */
  role: Role;
  /** True until the first auth-state + role resolution — avoid flashing wrong UI. */
  loading: boolean;
  /** True when the current role ranks at or above `min`. */
  hasRole: (min: Role) => boolean;
  /**
   * Force-refresh the ID token and re-read the role claim. Call after a role
   * change (e.g. an admin promoted this account) to pick it up without waiting
   * for the ~hourly automatic refresh.
   */
  refreshRole: () => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

/** Read the `role` custom claim off a user's ID token (optionally forcing refresh). */
async function readRole(user: User | null, forceRefresh = false): Promise<Role> {
  if (!user) return DEFAULT_ROLE;
  const result = await getIdTokenResult(user, forceRefresh);
  const claim = result.claims.role;
  return isRole(claim) ? claim : DEFAULT_ROLE;
}

/**
 * Resolve the effective role on sign-in, reconciling the token claim with the
 * server's source of truth. Hitting `/api/account/role` also triggers the
 * `ADMIN_EMAILS` bootstrap server-side; if the server reports a role the local
 * claim doesn't yet reflect, we force-refresh the token so the new claim lands.
 * Falls back to the local claim if the server round-trip fails (offline, etc.).
 */
async function syncRole(user: User): Promise<Role> {
  const claimRole = await readRole(user);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/account/role", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return claimRole;
    const data = (await res.json()) as { role?: unknown };
    const serverRole = isRole(data.role) ? data.role : DEFAULT_ROLE;
    // Claim lags the server truth (e.g. just-bootstrapped admin): refresh it.
    if (serverRole !== claimRole) {
      await readRole(user, true);
    }
    return serverRole;
  } catch {
    return claimRole;
  }
}

/**
 * Mint (on sign-in) or clear (on sign-out) the HttpOnly session cookie the SSE
 * streams authenticate with. Best-effort: if it fails, realtime simply falls
 * back to the anonymous public stream — REST calls still use Bearer tokens.
 */
async function syncSessionCookie(user: User | null): Promise<void> {
  try {
    if (user) {
      const token = await user.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      await fetch("/api/auth/session", { method: "DELETE" });
    }
  } catch {
    /* ignore — the stream degrades gracefully to the public caller */
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(DEFAULT_ROLE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!active) return;
      // Mint/clear the HttpOnly session cookie BEFORE exposing the user, so the
      // SSE streams (which re-subscribe on uid change) find the cookie in place.
      await syncSessionCookie(u);
      if (!active) return;
      setUser(u);
      // Resolve the role before clearing `loading` so role-gated UI doesn't
      // flash the wrong state. For a signed-in user we reconcile with the
      // server (also applies the ADMIN_EMAILS bootstrap); signed-out is "user".
      const resolved = u ? await syncRole(u) : DEFAULT_ROLE;
      if (!active) return;
      setRole(resolved);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      loading,
      hasRole: (min) => hasAtLeast(role, min),
      async refreshRole() {
        setRole(await readRole(auth.currentUser, true));
      },
      async signUpEmail(email, password, displayName) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(cred.user, { displayName });
        }
      },
      async signInEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signInGoogle() {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      async logout() {
        await signOut(auth);
      },
    }),
    [user, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth phải được dùng bên trong <AuthProvider>.");
  }
  return ctx;
}
