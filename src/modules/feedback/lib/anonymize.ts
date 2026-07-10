// src/modules/feedback/lib/anonymize.ts
/**
 * Pure rules for how much author identity a caller may see. The UI is anonymous
 * for everyone EXCEPT managers/admins, who may see the author's identity to
 * moderate. Kept pure (only a pure import from @/lib/roles) so it's testable.
 */
import { hasAtLeast, type Role } from "@/lib/roles";
import type { AuthorInfo } from "@/modules/feedback/types";

/** Managers and admins may see author identity; plain users and guests may not. */
export function canRevealIdentity(role: Role): boolean {
  return hasAtLeast(role, "manager");
}

/**
 * Compute the `author` field for a DTO. Returns `undefined` (fully anonymous) for
 * non-privileged callers. For privileged callers, returns the resolved identity,
 * falling back to a uid-only record if the lookup map has no entry.
 */
export function authorFieldFor(
  role: Role,
  authorUid: string,
  resolved: Map<string, { email: string | null; displayName: string | null }>,
): AuthorInfo | undefined {
  if (!canRevealIdentity(role)) return undefined;
  const info = resolved.get(authorUid);
  return {
    uid: authorUid,
    email: info?.email ?? null,
    displayName: info?.displayName ?? null,
  };
}
