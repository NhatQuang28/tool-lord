/**
 * Server-side role resolution and enforcement (Admin SDK, server-only).
 *
 * ROLE STORAGE (hybrid)
 * ---------------------
 * The authoritative role lives in `users/{uid}.role` (Firestore) and is mirrored
 * into the Firebase custom claim `role`. The claim is what travels inside the ID
 * token, so `requireRole` can read the caller's role WITHOUT an extra Firestore
 * read on the hot path. `setUserRole` is the single writer that keeps the two in
 * sync — always change a role through it.
 *
 * BOOTSTRAP
 * ---------
 * Brand-new accounts default to "user". To seed the very first admin(s) we read
 * `ADMIN_EMAILS` (comma-separated) from the server env: when a user whose email
 * is on that list authenticates, `resolveRole` transparently elevates them to
 * admin (writing both the claim and Firestore) the first time it sees them. This
 * is idempotent and needs no manual script.
 *
 * NOTE ON CLAIM PROPAGATION: a custom-claim change only appears in the client's
 * token after the token refreshes. The client calls `getIdToken(true)` (see
 * AuthProvider.refreshRole) to pick it up immediately; otherwise it lands on the
 * next hourly refresh. Server enforcement is unaffected — it re-reads the token
 * the client sends.
 */
import "server-only";
import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/auth/requireUser";
import { DEFAULT_ROLE, hasAtLeast, isRole, type Role } from "@/lib/roles";

/** Parsed, lowercased set of bootstrap admin emails from `ADMIN_EMAILS`. */
function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Set a user's role: writes the custom claim AND the Firestore mirror. This is
 * the ONLY place a role should change. Callers must ensure they're authorized
 * (e.g. behind `requireRole(req, "admin")`).
 */
export async function setUserRole(uid: string, role: Role): Promise<void> {
  if (!isRole(role)) {
    throw new Error(`Vai trò không hợp lệ: ${role}`);
  }
  await adminAuth.setCustomUserClaims(uid, { role });
  await adminDb.collection("users").doc(uid).set(
    {
      role,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Resolve the effective role for a verified token. Reads the `role` custom
 * claim, applies the `ADMIN_EMAILS` bootstrap, and returns a valid Role.
 *
 * The bootstrap write happens at most once per admin account (only when the
 * claim isn't already admin), so steady-state requests do no extra writes.
 */
export async function resolveRole(decoded: DecodedIdToken): Promise<Role> {
  const claimRole: Role = isRole(decoded.role) ? decoded.role : DEFAULT_ROLE;

  const email = decoded.email?.toLowerCase();
  if (email && adminEmails().has(email) && claimRole !== "admin") {
    await setUserRole(decoded.uid, "admin");
    return "admin";
  }

  return claimRole;
}

/** Outcome of a role gate: either an authorized caller, or an HTTP status. */
export type RoleGateResult =
  | { ok: true; user: DecodedIdToken; role: Role }
  | { ok: false; status: 401 | 403; error: string };

/**
 * API-route gate: verify identity, resolve role, and require at least `min`.
 *
 *   const gate = await requireRole(req, "admin");
 *   if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
 *   // ...use gate.user.uid / gate.role
 */
export async function requireRole(
  req: NextRequest,
  min: Role,
): Promise<RoleGateResult> {
  const user = await requireUser(req);
  if (!user) {
    return { ok: false, status: 401, error: "Chưa đăng nhập." };
  }

  const role = await resolveRole(user);
  if (!hasAtLeast(role, min)) {
    return { ok: false, status: 403, error: "Bạn không có quyền thực hiện thao tác này." };
  }

  return { ok: true, user, role };
}
