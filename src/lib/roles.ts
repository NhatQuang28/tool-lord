/**
 * Role model — pure, shared by client and server (no React / Firebase imports).
 *
 * Three hierarchical roles. Higher rank implies every capability of the lower
 * ones: user (0) < manager (1) < admin (2). A tool or API gate expresses the
 * MINIMUM role it needs; a caller passes their actual role and we compare ranks.
 *
 * The role is the SOURCE OF TRUTH in `users/{uid}.role` and is mirrored into the
 * Firebase custom claim `role` so the server can read it straight off the ID
 * token (see `lib/auth/roles.server.ts`). Keep this file dependency-free so it
 * stays unit-testable and safe to import from both bundles.
 */

export const ROLES = ["user", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Every brand-new account starts here. */
export const DEFAULT_ROLE: Role = "user";

/** Ordinal rank of each role; used for "at least this role" comparisons. */
export const ROLE_RANK: Record<Role, number> = {
  user: 0,
  manager: 1,
  admin: 2,
};

/** Vietnamese labels for UI (badges, dropdowns). */
export const ROLE_LABEL: Record<Role, string> = {
  user: "Người dùng",
  manager: "Quản lý",
  admin: "Quản trị",
};

/** Narrow an unknown value (e.g. a token claim) to a valid Role. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True when `role` ranks at or above `min` (the required minimum). */
export function hasAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * Roles that bypass credit accounting entirely (treated as unlimited quota).
 * Managers and admins are trusted internal roles, so their usage is not metered.
 */
export function isUnlimitedCredits(role: Role): boolean {
  return hasAtLeast(role, "manager");
}
