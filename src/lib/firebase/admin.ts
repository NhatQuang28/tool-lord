/**
 * Firebase Admin SDK singletons (server-side only).
 *
 * Uses a service-account credential built from server-only env vars. NEVER
 * import this from client code — it would leak the private key. Used to verify
 * ID tokens before running resource-heavy work (see `lib/auth/requireUser.ts`).
 *
 * IMPORTANT: initialization is LAZY. Importing this module has no side effects,
 * so it is safe to evaluate at build time (`next build` "collect page data")
 * even when FIREBASE_* env vars are absent. The credential is only read on the
 * first call to `getAdminAuth()` / `getAdminDb()`, which happens at request
 * time in production where the env vars are present.
 */
import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function createAdminApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The private key is stored with literal "\n"; turn them into real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Thiếu cấu hình Firebase Admin (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let cachedApp: App | undefined;
let cachedAuth: Auth | undefined;
let cachedDb: Firestore | undefined;

function getAdminApp(): App {
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : createAdminApp();
  }
  return cachedApp;
}

/** Lazily-initialized Firebase Admin Auth. Safe to import at build time. */
export function getAdminAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

/** Lazily-initialized Firestore (Admin). Safe to import at build time. */
export function getAdminDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}
