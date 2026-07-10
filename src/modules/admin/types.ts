import type { Role } from "@/lib/roles";

/** A user row shown in the admin panel: identity (Auth) + app data (Firestore). */
export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role;
  /** Remaining credits, or null when the account has no Firestore doc yet. */
  credits: number | null;
  /** ISO string of Auth account creation time, or null if unavailable. */
  createdAt: string | null;
}

export interface ListUsersResponse {
  users: AdminUser[];
  error?: string;
}

/** PATCH body for `/api/admin/users/[uid]` — either or both actions. */
export interface UpdateUserRequest {
  /** New role to assign. Omit to leave unchanged. */
  role?: Role;
  /** Positive number of credits to grant (added to the balance). Omit to skip. */
  grantCredits?: number;
}

export interface UpdateUserResponse {
  user?: AdminUser;
  error?: string;
}
