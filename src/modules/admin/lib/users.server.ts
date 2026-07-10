/**
 * Admin-only user directory helpers (server-only, Admin SDK).
 *
 * Identity (email, displayName, createdAt) lives in Firebase Auth; app data
 * (role, credits) lives in Firestore `users/{uid}`. Not every Auth user has a
 * Firestore doc yet (it's created lazily on first credit spend), so we enumerate
 * Auth as the master list and LEFT-JOIN the Firestore docs onto it.
 *
 * The role shown here is the Firestore mirror (source of truth) rather than the
 * custom claim, so a freshly-changed role is reflected immediately without
 * waiting for the target user's token to refresh.
 */
import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DEFAULT_ROLE, isRole, type Role } from "@/lib/roles";
import type { AdminUser } from "@/modules/admin/types";

/** Max Auth accounts to enumerate. One page is plenty for this app's scale. */
const MAX_USERS = 1000;

interface FirestoreUserData {
  role: Role;
  credits: number | null;
}

/** Read the Firestore `users` docs into a uid → {role, credits} map. */
async function firestoreUserData(): Promise<Map<string, FirestoreUserData>> {
  const snap = await adminDb.collection("users").get();
  const map = new Map<string, FirestoreUserData>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const role = isRole(data.role) ? data.role : DEFAULT_ROLE;
    const credits =
      typeof data.credits === "number" ? data.credits : null;
    map.set(doc.id, { role, credits });
  }
  return map;
}

/** List all users, merging Auth identity with Firestore role/credits. */
export async function listAllUsers(): Promise<AdminUser[]> {
  const [{ users: authUsers }, fsData] = await Promise.all([
    adminAuth.listUsers(MAX_USERS),
    firestoreUserData(),
  ]);

  return authUsers.map((u) => {
    const fs = fsData.get(u.uid);
    return {
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      role: fs?.role ?? DEFAULT_ROLE,
      credits: fs?.credits ?? null,
      createdAt: u.metadata.creationTime
        ? new Date(u.metadata.creationTime).toISOString()
        : null,
    };
  });
}

/** Fetch a single merged user by uid (or null if the Auth account is gone). */
export async function getAdminUser(uid: string): Promise<AdminUser | null> {
  try {
    const [authUser, snap] = await Promise.all([
      adminAuth.getUser(uid),
      adminDb.collection("users").doc(uid).get(),
    ]);
    const data = snap.exists ? snap.data() : undefined;
    return {
      uid: authUser.uid,
      email: authUser.email ?? null,
      displayName: authUser.displayName ?? null,
      role: data && isRole(data.role) ? data.role : DEFAULT_ROLE,
      credits:
        data && typeof data.credits === "number" ? data.credits : null,
      createdAt: authUser.metadata.creationTime
        ? new Date(authUser.metadata.creationTime).toISOString()
        : null,
    };
  } catch {
    return null;
  }
}
