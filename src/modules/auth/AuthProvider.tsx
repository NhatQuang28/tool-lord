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
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";

interface AuthContextValue {
  /** Signed-in user, or null when signed out. */
  user: User | null;
  /** True until the first auth-state resolution — avoid flashing wrong UI. */
  loading: boolean;
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
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
    [user, loading],
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
